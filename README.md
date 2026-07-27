# DogDex Backend

NestJS API for DogDex.

## Start here

- [Backend architecture and coding contract](docs/architecture/architecture-design.md)
- [Environment template](.env.example)
- [Agent rules](AGENTS.md)

## Commands

```bash
npm install
copy .env.example .env.local
npm run start:dev
npm run build
npm test -- --runInBand
```

Production reads `.env.prod` through `npm run start:prod`. Keep real deployment secrets outside source control.
