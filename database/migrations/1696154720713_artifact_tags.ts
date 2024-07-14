import BaseSchema from '@ioc:Adonis/Lucid/Schema'

export default class extends BaseSchema {
  protected tableName = 'artifact_tag'

  public async up () {
    this.schema.createTable(this.tableName, (table) => {
      table.increments('id')

      table.integer('artifact_id').unsigned().references('id').inTable('artifacts').notNullable()
      table.integer('tag_id').unsigned().references('id').inTable('tags').notNullable()

      table.unique(['artifact_id', 'tag_id'])
    })
  }

  public async down () {
    this.schema.dropTable(this.tableName)
  }
}
