import dotenv from 'dotenv';
dotenv.config();

export const env = {
  PORT: process.env.PORT || '3000',
  JWT_SECRET: process.env.JWT_SECRET || 'central_restaurante_super_secret_key_2026_crypt',
  DB_PATH: process.env.DB_PATH || 'database.sqlite',
  NODE_ENV: process.env.NODE_ENV || 'development'
};
