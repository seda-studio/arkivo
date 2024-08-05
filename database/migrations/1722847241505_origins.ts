import BaseSchema from '@ioc:Adonis/Lucid/Schema'

export default class extends BaseSchema {
  protected tableName = 'origins'

  public async up () {
    this.schema.createTable(this.tableName, (table) => {
      table.increments('id').primary()

      table.string('scheme').notNullable()
      table.string('domain').notNullable()
      table.integer('port').notNullable()


      table.unique(['scheme', 'domain', 'port'])
    })
  }

  public async down () {
    this.schema.dropTable(this.tableName)
  }
}
