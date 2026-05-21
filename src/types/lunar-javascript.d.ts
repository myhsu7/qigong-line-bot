declare module 'lunar-javascript' {
    export class Lunar {
        static fromDate(date: Date): Lunar;
        getJieQi(): string;
        getNextJieQi(): any;
        getJieQiTable(): Record<string, Solar>;
    }
    
    export class Solar {
        toYmd(): string;
    }
}
