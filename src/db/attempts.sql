-- 验证码尝试次数上限（防爆破）
ALTER TABLE email_codes ADD COLUMN attempts INTEGER NOT NULL DEFAULT 0;
