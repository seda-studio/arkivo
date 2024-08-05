import { BaseModel, column, manyToMany, ManyToMany } from '@ioc:Adonis/Lucid/Orm'
import Artifact from 'App/Models/Artifact'

export default class Origin extends BaseModel {
  @column({ isPrimary: true })
  public id: number

  @column()
  public scheme: string

  @column()
  public domain: string

  @column()
  public port: number

  @manyToMany(() => Artifact)
  public artifacts: ManyToMany<typeof Artifact>
}
