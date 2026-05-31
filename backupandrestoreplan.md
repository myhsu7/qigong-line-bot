# Qigong LINE Bot - Backup & High Availability (HA) Plan

This document outlines the strategy for ensuring zero (or near-zero) data loss and rapid recovery for the Qigong LINE bot's PostgreSQL database.

## Target SLO (Service Level Objective)
*   **RPO (Recovery Point Objective):** 0 seconds (with synchronous replica) or near-zero (with async/WAL archiving).
*   **RTO (Recovery Time Objective):** 10–30 minutes with a manual failover runbook.
*   **Backup Retention:** 30 days PITR (Point-In-Time Recovery) + monthly long-term logical snapshots.

---

## Architecture Blueprint

1.  **Primary DB (Ubuntu Home Server)**
    *   Runs the `qigong_db` Postgres 15 Docker container.
    *   Handles all bot reads and writes.
2.  **Standby DB (VPS or 2nd Home Machine)**
    *   Postgres hot standby via streaming replication connected via **Tailscale**.
    *   Read-only until manually promoted.
3.  **Offsite Backup Storage**
    *   S3-compatible bucket (e.g., Backblaze B2, Cloudflare R2, AWS S3).
    *   Stores daily base backups and continuous WAL (Write-Ahead Log) archives.

---

## Stage A: Backup + PITR Foundation

### 1. Enable WAL Archiving
On the Primary DB, mount a host directory (e.g., `/opt/qigong-backup/wal`) to the container (`/wal_archive`).
Update Postgres settings inside the container:
```sql
ALTER SYSTEM SET wal_level = replica;
ALTER SYSTEM SET archive_mode = on;
ALTER SYSTEM SET archive_command = 'test ! -f /wal_archive/%f && cp %p /wal_archive/%f';
ALTER SYSTEM SET archive_timeout = '60s';
```
*(Restart the container to apply `wal_level` and `archive_mode`).*

### 2. Nightly Backup Cron Jobs
Run these on the Ubuntu host via `cron`:

*   **Physical Base Backup:**
    ```bash
    docker exec qigong_db pg_basebackup -U qigong_user -D /tmp/basebackup -Fp -Xs -P
    ```
*   **Logical Dump (Portable):**
    ```bash
    docker exec qigong_db pg_dump -U qigong_user -d qigong_bot -Fc > /opt/qigong-backup/dump/qigong_bot_$(date +%F).dump
    ```

### 3. Offsite Sync
Schedule a nightly `rclone` or `restic` job to securely sync `/opt/qigong-backup` to your S3-compatible cloud storage.

---

## Stage B: High Availability (Standby Replica)

### 1. Configure Primary
Create a replication user and a physical replication slot:
```sql
CREATE ROLE replicator WITH REPLICATION LOGIN PASSWORD 'STRONG_PASSWORD';
SELECT * FROM pg_create_physical_replication_slot('qigong_standby_1');
```
Update `pg_hba.conf` to allow the standby's Tailscale IP to connect as the `replicator` user.

### 2. Seed and Start Standby
On the Standby machine, run `pg_basebackup` pointing to the Primary's Tailscale IP to fetch the initial data.
Configure the standby's `postgresql.conf` to follow the primary using `primary_conninfo` and `primary_slot_name = 'qigong_standby_1'`.

### 3. Synchronous Mode (Optional, for Zero-Loss)
To guarantee zero data loss, force the primary to wait for the standby to confirm writes:
```sql
ALTER SYSTEM SET synchronous_commit = 'remote_apply';
ALTER SYSTEM SET synchronous_standby_names = 'FIRST 1 (qigong_standby_1)';
```
*(Warning: If the standby goes offline, writes on the primary will block. Use async mode for higher availability at the cost of slight data loss risk).*

---

## Disaster Recovery (DR) Runbook

### Failover Procedure (If Primary Crashes)
1.  **Promote Standby:** On the standby server, execute `pg_ctl promote -D <data_dir>` (or trigger promotion via Docker).
2.  **Update App Config:** Change the `.env` `DATABASE_URL` on your Node.js server to point to the Standby's Tailscale IP.
3.  **Restart App:** `pm2 restart qigong-line-bot --update-env`.
4.  **Verify:** Send a test check-in via the LINE app.

### Monthly Drill (Non-Negotiable)
1.  Restore the latest logical dump into a temporary ephemeral Postgres container.
2.  Validate row counts (`users`, `checkin_logs`, `user_badges`).
3.  Verify the timestamp of the latest check-in.
4.  Record the recovery time in an ops log.
