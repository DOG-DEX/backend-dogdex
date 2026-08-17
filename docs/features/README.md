# Backend Modules Index

Per-module documentation and progress tracking for the **Dog Dex Backend** API (`backend-dogdex`).

## Feature Modules

| Module | Endpoints | Progress | Description |
|--------|-----------|----------|-------------|
| **Auth** | `/api/auth/*` | [progress.md](./auth/progress.md) | JWT access/refresh token issue, login, register, OAuth, logout |
| **Users** | `/api/users/*` | [progress.md](./users/progress.md) | User profile, settings, roles, avatar upload |
| **Dogs** | `/api/dogs/*` | [progress.md](./dogs/progress.md) | Dog breed catalog query, physical traits, search |
| **Predictions** | `/api/predictions/*` | [progress.md](./predictions/progress.md) | Async AI image classification, BullMQ queue, confidence score |
| **Community** | `/api/community/*` | [progress.md](./community/progress.md) | Community posts, breed tagging, likes, comments |
| **Pets** | `/api/pets/*` | [progress.md](./pets/progress.md) | User pet digital IDs, medical & vaccination records |
| **Catalog** | `/api/catalog/*` | [progress.md](./catalog/progress.md) | Extended breed taxonomy & characteristics metadata |
| **Media** | `/api/media/*` | [progress.md](./media/progress.md) | Multer upload, Sharp WebP processing, Cloudinary storage |
| **Moderation** | `/api/moderation/*` | [progress.md](./moderation/progress.md) | Admin/Moderator post review queue, content flagging |
| **Payment** | `/api/payment/*` | [progress.md](./payment/progress.md) | MoMo payment gateway integration, transaction logs |
| **Analytics** | `/api/analytics/*` | [progress.md](./analytics/progress.md) | Admin system usage metrics, prediction volume |
| **Admin** | `/api/admin/*` | [progress.md](./admin/progress.md) | System administration, user bans, role management |

## Adding a new backend module

1. Generate module structure in `src/modules/<name>/` (`controller`, `service`, `dto`, `schema`, `module`).
2. Create `docs/features/<name>/progress.md` using the standard module progress template.
3. Add a row to [PROGRESS.md](../PROGRESS.md) master table.
4. Update this index table.
5. Add entry to `CHANGELOG.md` (MINOR version bump).
