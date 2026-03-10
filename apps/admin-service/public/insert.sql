
INSERT INTO "modules" ("id", "name", "sort_order") VALUES
    ('dashboard',         'Dashboard',             1),
    ('transactions',      'Transactions',          2),
    ('reports',           'Reports',               3),
    ('settlements',       'Settlements',           4),
    ('reconciliations',   'Reconciliations',       5),
    ('user_management',   'User Management',       6),
    ('audit',             'Audit',                 7),
    ('roles_permissions', 'Roles and Permissions', 8),
    ('admin_management',  'Admin Management',      9)
ON CONFLICT ("id") DO NOTHING;


INSERT INTO "permissions" ("id", "name", "sort_order", "description", "module_id") VALUES
    ('dashboard:view', 'View Dashboard', 1, NULL, (SELECT "id" FROM "modules" WHERE "id" = 'dashboard')),
    -- Transactions
    ('transactions:view', 'View Transactions', 1, NULL, (SELECT "id" FROM "modules" WHERE "id" = 'transactions')),
    -- Reports
    ('reports:view',   'View Reports',   1, NULL, (SELECT "id" FROM "modules" WHERE "id" = 'reports')),
    ('reports:export', 'Export Reports', 2, NULL, (SELECT "id" FROM "modules" WHERE "id" = 'reports')),
    -- Settlements
    ('settlements:view', 'View Settlements', 1, NULL, (SELECT "id" FROM "modules" WHERE "id" = 'settlements')),
    -- Reconciliations
    ('reconciliations:view', 'View Reconciliations', 1, NULL, (SELECT "id" FROM "modules" WHERE "id" = 'reconciliations')),
    ('reconciliations:edit', 'Edit Reconciliations', 2, NULL, (SELECT "id" FROM "modules" WHERE "id" = 'reconciliations')),
    -- User Management
    ('user_management:view', 'View User Management', 1, NULL, (SELECT "id" FROM "modules" WHERE "id" = 'user_management')),
    -- Audit
    ('audit:view',   'View Audit',   1, NULL, (SELECT "id" FROM "modules" WHERE "id" = 'audit')),
    -- Roles and Permissions
    ('roles_permissions:view',   'View Roles and Permissions', 1, NULL, (SELECT "id" FROM "modules" WHERE "id" = 'roles_permissions')),
    ('roles_permissions:create', 'Create Roles',               2, 'Allow creating new role and assign the permission.', (SELECT "id" FROM "modules" WHERE "id" = 'roles_permissions')),
    ('roles_permissions:edit',   'Edit Roles',                 3, 'Allow editing role and change the permission.', (SELECT "id" FROM "modules" WHERE "id" = 'roles_permissions')),
    ('roles_permissions:delete', 'Delete Roles',               4, NULL, (SELECT "id" FROM "modules" WHERE "id" = 'roles_permissions')),
    -- Admin Management
    ('admin_management:view',   'View Admins',   1, NULL, (SELECT "id" FROM "modules" WHERE "id" = 'admin_management')),
    ('admin_management:create', 'Create Admins', 2, 'Allow creating new admin user and assign the role.', (SELECT "id" FROM "modules" WHERE "id" = 'admin_management')),
    ('admin_management:edit',   'Edit Admins',   3, 'Allow editing admin user and change the role.', (SELECT "id" FROM "modules" WHERE "id" = 'admin_management')),
    ('admin_management:delete', 'Delete Admins', 4, NULL, (SELECT "id" FROM "modules" WHERE "id" = 'admin_management'))
ON CONFLICT ("id") DO NOTHING;


WITH now_unix AS ( SELECT EXTRACT(EPOCH FROM NOW())::INT AS ts )
INSERT INTO "roles" ("id", "name", "is_system_generated", "description", "created_at", "updated_at")
SELECT * FROM
    (SELECT 'admin', 'Administrator', true, 'Role with full authorities over backoffice portal.', ts, ts FROM now_unix
     UNION ALL
     SELECT 'default', 'Default', true, 'Default role with basic permission for newly created admin.', ts, ts FROM now_unix) as role_data
ON CONFLICT ("id") DO NOTHING;

WITH now_unix AS ( SELECT EXTRACT(EPOCH FROM NOW())::INT AS ts )
INSERT INTO "roles" ("id", "name", "is_system_generated", "description", "created_at", "updated_at")
SELECT * FROM (
    SELECT 'admin' AS id,
           'Administrator' AS name,
           true AS is_system_generated,
           'Role with full authorities over backoffice portal.' AS description,
           ts AS created_at,
           ts AS updated_at
    FROM now_unix
    UNION ALL
    SELECT 'default', 'Default', true, 'Default role with basic permission for newly created admin.', ts, ts FROM now_unix
) AS insert_data
ON CONFLICT ("id") DO NOTHING;


INSERT INTO "permissions_roles" ("permission_id", "role_id") VALUES
    ('dashboard:view', 'default'),
    -- Admin Permissions
    ('dashboard:view',           'admin'),
    ('transactions:view',        'admin'),
    ('reports:view',             'admin'),
    ('reports:export',           'admin'),
    ('settlements:view',         'admin'),
    ('reconciliations:view',     'admin'),
    ('reconciliations:edit',     'admin'),
    ('user_management:view',     'admin'),
    ('audit:view',               'admin'),
    ('roles_permissions:view',   'admin'),
    ('roles_permissions:create', 'admin'),
    ('roles_permissions:edit',   'admin'),
    ('roles_permissions:delete', 'admin'),
    ('admin_management:view',    'admin'),
    ('admin_management:create',  'admin'),
    ('admin_management:edit',    'admin'),
    ('admin_management:delete',  'admin')
ON CONFLICT ("permission_id", "role_id") DO NOTHING;
