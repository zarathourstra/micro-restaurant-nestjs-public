import { Joi } from '../config/config.js';

import { PreparedItemLiteValidator } from './prepared-item-lite.validator.js';

export const PreparationLiteValidator = Joi.object({
  _id: Joi.string().required(),
  sentAt: Joi.string().isoDate().required(),
  shouldBeReadyAt: Joi.string().isoDate().required(),
  itemsSent: Joi.array().items(
    Joi.object({
      menuItemShortName: Joi.string().required(),
      howMany: Joi.number().min(0).required(),
    })
  ).required(),
  preparedItems: Joi.array().items(PreparedItemLiteValidator),
});
