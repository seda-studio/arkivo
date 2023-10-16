import { DateTime } from 'luxon'
import { BaseModel, column, manyToMany, ManyToMany } from '@ioc:Adonis/Lucid/Orm'
import Tag from 'App/Models/Tag'

export default class Artifact extends BaseModel {
  @column({ isPrimary: true })
  public id: number

  @column()
  public chain: string

  @column()
  public contractAddress: string

  @column()
  public tokenId: string

  @column()
  public metadataUri: string

  @column()
  public artifactUri: string

  @column()
  public displayUri: string

  @column()
  public title: string

  @column()
  public description: string | null

  @column()
  public mimeType: string

  @column()
  public creatorAddress: string

  @column()
  public artifactSize: number | null

  @column()
  public isFetched: boolean

  @column()
  public isPinned: boolean

  @column()
  public isNetworked: boolean

  @column.dateTime({ autoCreate: true })
  public createdAt: DateTime

  @column.dateTime({ autoCreate: true, autoUpdate: true })
  public updatedAt: DateTime

  @manyToMany(() => Tag)
  public tags: ManyToMany<typeof Tag>
}
