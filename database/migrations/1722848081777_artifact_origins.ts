import BaseSchema from '@ioc:Adonis/Lucid/Schema'

export default class extends BaseSchema {
  protected tableName = 'artifact_origin'

  public async up () {
    this.schema.createTable(this.tableName, (table) => {
      table.increments('id').primary()

      table.integer('artifact_id').unsigned().references('id').inTable('artifacts').notNullable()
      table.integer('origin_id').unsigned().references('id').inTable('origins').notNullable()

      table.unique(['artifact_id', 'origin_id'])
    })
  }

  public async down () {
    this.schema.dropTable(this.tableName)
  }
}
