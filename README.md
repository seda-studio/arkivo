# arkivo
conservation of networked cryptoart

## Requirements:

node, npm, docker, docker compose

## Installation:

1. clone repo

2. `npm install`

3. install playwright browsers

``` npx playwright install
    npx playwright install-deps
```

4. `node ace build`

5. Setup your `.env` files (see example file for guidance)

6. `docker compose up` to start the docker containers

7. `npm run dockerMigrateRun` to initialise DB