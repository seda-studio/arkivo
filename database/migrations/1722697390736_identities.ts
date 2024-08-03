import BaseSchema from '@ioc:Adonis/Lucid/Schema'

export default class extends BaseSchema {
  protected tableName = 'identities'

  public async up () {
    this.schema.createTable(this.tableName, (table) => {
      table.increments('id')

      table.string('account').notNullable()
      table.text('alias')
      table.text('description')
      table.string('discord')
      table.text('domain_name')
      table.string('ethereum')
      table.string('github')
      table.text('logo')
      table.string('twitter')
      table.text('website')

      table.unique(['account'])

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
