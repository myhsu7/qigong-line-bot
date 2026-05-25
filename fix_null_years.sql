-- If any null values were somehow inserted into user_badges.earned_year,
-- this script safely updates them to 0 (which is our new default for non-seasonal badges)
-- to ensure they comply with the Primary Key constraint.

-- Update any existing nulls to 0
UPDATE user_badges SET earned_year = 0 WHERE earned_year IS NULL;
