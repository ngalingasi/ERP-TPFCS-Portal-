-- ERP Portal Database
-- Run once to set up the ERP schema

CREATE DATABASE IF NOT EXISTS erp_portal_db
  CHARACTER SET utf8mb4
  COLLATE utf8mb4_unicode_ci;

USE erp_portal_db;

-- ─── software_profiles ────────────────────────────────────────────────────────
-- icon column stores a lucide icon name string (e.g. "shield-check", "monitor")
-- The frontend maps this to the correct lucide-react component.

CREATE TABLE IF NOT EXISTS software_profiles (
  id           INT          NOT NULL AUTO_INCREMENT,
  name         VARCHAR(120) NOT NULL,
  description  VARCHAR(255) DEFAULT NULL,
  api_base_url VARCHAR(255) NOT NULL,
  app_url      VARCHAR(255) NOT NULL,
  icon         VARCHAR(80)  DEFAULT 'monitor',   -- lucide icon name
  erp_secret   VARCHAR(128) NOT NULL,
  is_default   TINYINT(1)   NOT NULL DEFAULT 0,  -- only ONE row should be 1
  is_active    TINYINT(1)   NOT NULL DEFAULT 1,
  sort_order   INT          NOT NULL DEFAULT 0,
  created_by   INT          DEFAULT NULL,
  created_at   DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at   DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE KEY uq_name (name)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- ─── Trigger: enforce only one default at a time ──────────────────────────────
DELIMITER $$
DROP TRIGGER IF EXISTS trg_single_default_insert$$
CREATE TRIGGER trg_single_default_insert
  BEFORE INSERT ON software_profiles
  FOR EACH ROW
BEGIN
  IF NEW.is_default = 1 THEN
    UPDATE software_profiles SET is_default = 0;
  END IF;
END$$

DROP TRIGGER IF EXISTS trg_single_default_update$$
CREATE TRIGGER trg_single_default_update
  BEFORE UPDATE ON software_profiles
  FOR EACH ROW
BEGIN
  IF NEW.is_default = 1 AND OLD.is_default = 0 THEN
    UPDATE software_profiles SET is_default = 0 WHERE id != NEW.id;
  END IF;
END$$
DELIMITER ;

-- ─── Seed ─────────────────────────────────────────────────────────────────────
-- icon values map to lucide-react icon names used in the frontend SystemIcon component.
-- Replace erp_secret values with strong random strings before deploying.
-- The same value must be set in each child system's .env as ERP_SECRET=<value>

INSERT INTO software_profiles
  (name, description, api_base_url, app_url, icon, erp_secret, is_default, is_active, sort_order)
VALUES
  (
    'URA Security System',
    'Primary authentication system — Tanzania Police Force URA module',
    'http://localhost:3001',
    'http://localhost:5175',
    'shield-check',
    'CHANGE_THIS_URA_SECRET_BEFORE_DEPLOY',
    1,
    1,
    1
  ),
  (
    'ICDV Management',
    'Inland Container Depot & Vehicles management system',
    'http://localhost:3002',
    'http://localhost:5173',
    'container',
    'CHANGE_THIS_ICDV_SECRET_BEFORE_DEPLOY',
    0,
    1,
    2
  ),
  (
    'Project Management',
    'TPFCS project tracking and monitoring system',
    'http://localhost:3003',
    'http://localhost:5176',
    'layout-dashboard',
    'CHANGE_THIS_PROJ_SECRET_BEFORE_DEPLOY',
    0,
    1,
    3
  ),
  (
    'Management System',
    'TPFCS workforce and HR management system',
    'http://localhost:8686',
    'http://localhost:5174',
    'building-2',
    'CHANGE_THIS_MGMT_SECRET_BEFORE_DEPLOY',
    0,
    1,
    4
  );
