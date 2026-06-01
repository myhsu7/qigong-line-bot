import { Request, Response, NextFunction } from 'express';
import parser from 'accept-language-parser';
import { zhTW } from '../i18n/zh-TW';
import { en } from '../i18n/en';

// Extend Express Request interface to include custom lang properties
declare global {
    namespace Express {
        interface Request {
            langCode: 'zh-TW' | 'en';
            i18n: typeof zhTW;
        }
    }
}

export const resolveLanguage = (req: Request, res: Response, next: NextFunction) => {
    let langCode: 'zh-TW' | 'en' = 'zh-TW';

    // 1. Check URL query first
    if (req.query.lang === 'en') {
        langCode = 'en';
    } else if (req.query.lang === 'zh-TW') {
        langCode = 'zh-TW';
    } else {
        // 2. Check Accept-Language header
        const acceptLang = req.headers['accept-language'];
        if (acceptLang) {
            const parsed = parser.parse(acceptLang);
            // Look for English explicitly, otherwise default to zh-TW
            const isEnglishFirst = parsed.find((l: any) => l.code === 'en');
            const isChineseFirst = parsed.find((l: any) => l.code === 'zh');
            
            if (isEnglishFirst && (!isChineseFirst || (isChineseFirst && (isEnglishFirst.quality || 1) > (isChineseFirst.quality || 1)))) {
                langCode = 'en';
            }
        }
    }

    req.langCode = langCode;
    req.i18n = langCode === 'en' ? en : zhTW;
    next();
};
