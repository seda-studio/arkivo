import BaseSchema from '@ioc:Adonis/Lucid/Schema'

export default class extends BaseSchema {
  protected tableName = 'artifacts'

  public async up () {
    this.schema.createTable(this.tableName, (table) => {
      table.increments('id').primary()
      table.string('chain').notNullable()
      table.string('contract_address').notNullable()
      table.string('token_id').notNullable()
      table.text('platform')
      table.text('metadata_uri')
      table.text('artifact_uri')
      table.text('display_uri')
      table.text('thumbnail_uri')
      table.text('title')
      table.text('description')
      table.string('mime_type')
      table.string('artist_address').notNullable()
      table.integer('artifact_size').nullable()
      table.integer('editions').notNullable()
      table.boolean('is_fetched').notNullable()
      table.boolean('is_pinned').notNullable()
      table.boolean('is_networked').notNullable()
      table.boolean('is_burned').notNullable()
      table.boolean('is_restricted').notNullable()
      table.timestamp('minted_at', { useTz: true }).nullable()

      table.unique(['chain', 'contract_address', 'token_id'])

      /**
       * Uses timestamptz for PostgreSQL and DATETIME2 for MSSQL
       */
      table.timestamp('created_at', { useTz: true })
      table.timestamp('updated_at', { useTz: true })
    })
  }

  public async down () {
    this.schema.dropTable(this.tableName)
  }
}
