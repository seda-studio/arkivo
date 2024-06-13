/*
|--------------------------------------------------------------------------
| Routes
|--------------------------------------------------------------------------
|
| This file is dedicated for defining HTTP routes. A single file is enough
| for majority of projects, however you can define routes in different
| files and just make sure to import them inside this file. For example
|
| Define routes in following two files
| ├── start/routes/cart.ts
| ├── start/routes/customer.ts
|
| and then import them inside `start/routes.ts` as follows
|
| import './routes/cart'
| import './routes/customer''
|
*/

import Route from '@ioc:Adonis/Core/Route'
import Logger from '@ioc:Adonis/Core/Logger'


Route.get('/', async ({ view }) => {
  Logger.info('##### accounts migration up: using PG_DB_NAME: ' + process.env.PG_DB_NAME)
  return view.render('welcome')
})

Route.group(() => { 

  Route.get('/', 'ArtifactsController.index').as('index')

  Route.get('/:id', 'ArtifactsController.show').as('show')

  Route.post('/', 'ArtifactsController.store').as('store')

  Route.post('/:id/edit', 'ArtifactsController.update').as('edit')

  Route.put('fetch', 'ArtifactsController.fetch').as('fetch')

  Route.delete('/:id', 'ArtifactsController.destroy').as('destroy')

}).prefix('/artifacts').as('artifacts.')
