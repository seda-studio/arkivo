import BaseSchema from '@ioc:Adonis/Lucid/Schema'

export default class extends BaseSchema {
  protected tableName = 'tags'

  public async up () {
    this.schema.createTable(this.tableName, (table) => {
      table.increments('id').primary()
      table.string('tag').unique().notNullable()
    })
  }

  public async down () {
    this.schema.dropTable(this.tableName)
  }
}
