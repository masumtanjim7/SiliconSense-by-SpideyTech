-- Creates the isolated test database for pytest integration runs
SELECT 'CREATE DATABASE siliconsense_test'
WHERE NOT EXISTS (SELECT FROM pg_database WHERE datname = 'siliconsense_test')\gexec