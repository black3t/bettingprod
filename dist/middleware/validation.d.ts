import { Request, Response, NextFunction } from 'express';
import Joi from 'joi';
declare const schemas: {
    signup: Joi.ObjectSchema<any>;
    login: Joi.ObjectSchema<any>;
    launchGame: Joi.ObjectSchema<any>;
    updateProfile: Joi.ObjectSchema<any>;
    walletDebit: Joi.ObjectSchema<any>;
    walletCredit: Joi.ObjectSchema<any>;
    limitsCheck: Joi.ObjectSchema<any>;
    playerExcluded: Joi.ObjectSchema<any>;
    balanceChanged: Joi.ObjectSchema<any>;
};
export declare const validate: (schemaName: keyof typeof schemas) => (req: Request, res: Response, next: NextFunction) => void;
export {};
//# sourceMappingURL=validation.d.ts.map