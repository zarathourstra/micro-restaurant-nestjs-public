# micro-restaurant NestJS implementation

Microservice implementation of a restaurant management system

* Author: Christian Brel

#### _Until september 2024, see former project here: https://github.com/collet/micro-restaurant-public_


## Principles

* Bounded contexts used for the different context of usage within the restaurant
* Isolated micro-services with own DB

**Not applied:**

* Event sourcing with event bus
* Full DDD

## Features

* Menu management (with type of entry + image associated)
* Table management (table numbering)
* Table order management (start/end order on a table, add items, send them to kitchen, bill)
* Kitchen management (receiving batches of menu items to be cooked, making them available and tracing when they are taken back to table)

**Not yet implemented:**

* Proper logging
* External Bank system

## List of micro-services

* `menu-service` (deployed on `http://localhost:3000/menus` with API doc at `/doc/menus`): implements the content of the menu, which could be used to display it, checks consistency with other services using the menu items.
* `dining-service` (deployed on `http://localhost:3001/tables and /tableOrders` with API doc at `doc/dining`): implements the dining room context, with table management, and ordering at the table level.
  This service is coupled to menu to get the menu entries, and to kitchen to send the orders to be prepared one the ordering is done.
* `kitchen-service` (deployed on `http://localhost:3002/kitchen` with API doc at `doc/kitchen`): implements the kitchen context, receiving batches of items to be cooked and served back.

* `integration-tests`: a specific service that run end to end tests at the API level through frisby after docker-composing the other services.
* `gateway` sets up a gateway to `http://localhost:9500` with subroutes to the different micro-services
* `seed`: a script that fills the databases of the three services with the principal models (menu items, recipes, tables, plus sample table orders, preparations and prepared items). Run `npm install && npm run seed` in this folder once the services are started (`npm run seed:reset` clears the orders first).

##  Common implementation stack

The tech stack is based on:
* Node 22.19.0 (Latest LTS: Jod)
* NestJS 11.1.6
* Typescript 5.9.2
* MongoDB 4.4.15
* Docker Engine 20.10+
* Docker Compose 2.6+
* Unit-tests, Component-tests with Jest 30.1.3, Supertest 7.1.4, frisby 2.1.3 (see `package.json`)

Each service is dockerized with its DB. The following scripts are provided:
* `build.sh` compiles and containerizes the service
* `start.sh` runs it through docker compose
* `stop.sh` puts down the docker composition
  *but the start/stop scripts were developed for the MVP. The "all" version below should be used.*

The overall build and run of all services (+ the integration testing service) are managed through the following scripts:
* `build-all.sh` runs the build in each service (except testing services)
* `run-local-integrationtest.sh` compiles and runs the integration tests (without prior building of the services), starting and stopping all the services
* `start-all.sh` runs all the services with a single docker-compose (**and enables to see the swagger doc**)
* `stop-all.sh` puts down the previous composition
