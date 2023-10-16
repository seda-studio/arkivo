import { BaseModel, column, manyToMany, ManyToMany } from '@ioc:Adonis/Lucid/Orm'
import Artifact from 'App/Models/Artifact'

export default class Tag extends BaseModel {
  @column({ isPrimary: true })
  public id: number

  @column()
  public tag: string

  @manyToMany(() => Artifact)
  public artifacts: ManyToMany<typeof Artifact>
}
