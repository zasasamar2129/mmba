# MMBA — Customer Database Specification

Version: 1.0.0
Status: MVP Approved

## Purpose
The Customer record is the master identity record for every person interacting with MMBA. Other modules reference this record rather than duplicating customer identity data.

## Core rules
- A customer is never physically deleted.
- `mobile` is the primary unique lookup key.
- Re-entering an existing mobile must open the existing customer rather than create a duplicate.
- Customer identity fields are stored once and reused by contracts, interactions, tasks, payments and attachments.
- Important changes must be auditable.

## Table: customers

| Field | Type | Null | Default | Notes |
|---|---|---:|---|---|
| id | BIGINT UNSIGNED | No | auto | PK |
| customer_code | VARCHAR(20) | No | generated | Unique, e.g. CUS-000001 |
| first_name | VARCHAR(80) | No | — | |
| last_name | VARCHAR(80) | No | — | |
| mobile | VARCHAR(15) | No | — | Unique; normalized |
| mobile2 | VARCHAR(15) | Yes | NULL | |
| phone | VARCHAR(20) | Yes | NULL | |
| national_code | VARCHAR(10) | Yes | NULL | Unique when present |
| gender | ENUM('male','female','unknown') | No | unknown | |
| birthday | DATE | Yes | NULL | |
| city | VARCHAR(100) | Yes | NULL | |
| address | TEXT | Yes | NULL | |
| occupation | VARCHAR(150) | Yes | NULL | |
| referral_source | VARCHAR(50) | Yes | NULL | Controlled values at app layer |
| referred_by_customer_id | BIGINT UNSIGNED | Yes | NULL | FK to customers.id |
| customer_status | ENUM('prospect','negotiation','active','installment','vip','inactive','blacklist') | No | prospect | |
| customer_score | TINYINT UNSIGNED | No | 0 | 0–100 |
| credit_level | ENUM('unknown','low','medium','high','vip') | No | unknown | |
| first_contact_at | DATETIME | Yes | NULL | |
| last_contact_at | DATETIME | Yes | NULL | |
| last_purchase_at | DATETIME | Yes | NULL | |
| notes | TEXT | Yes | NULL | Internal |
| archived | BOOLEAN | No | false | Soft delete |
| created_by | BIGINT UNSIGNED | No | — | FK to users.id |
| updated_by | BIGINT UNSIGNED | No | — | FK to users.id |
| created_at | DATETIME | No | current timestamp | |
| updated_at | DATETIME | No | current timestamp | |

## Indexes
- PRIMARY KEY (`id`)
- UNIQUE (`customer_code`)
- UNIQUE (`mobile`)
- UNIQUE (`national_code`) where supported with nullable values
- INDEX (`last_name`, `first_name`)
- INDEX (`customer_status`)
- INDEX (`last_contact_at`)
- INDEX (`city`)
- INDEX (`archived`)

## Mobile normalization
Accept common Iranian forms such as `0912...` and `+98912...`; normalize to one canonical stored format before uniqueness checks.

## Relationships
- `referred_by_customer_id` → `customers.id`
- `created_by` → `users.id`
- `updated_by` → `users.id`

## Migration notes
Do not implement hard delete. Future transactional tables may store immutable legal snapshots only when explicitly required.
