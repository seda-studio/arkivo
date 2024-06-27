import { DateTime } from 'luxon'
import { BaseModel, column, HasMany, hasMany, manyToMany, ManyToMany } from '@ioc:Adonis/Lucid/Orm'
import Tag from 'App/Models/Tag'
import Snapshot from 'App/Models/Snapshot'

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
  public platform: string

  @column()
  public metadataUri: string

  @column()
  public artifactUri: string

  @column()
  public displayUri: string

  @column()
  public thumbnailUri: string

  @column()
  public title: string

  @column()
  public description: string | null

  @column()
  public mimeType: string

  @column()
  public artistAddress: string

  @column()
  public mintedAt: DateTime

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

  @hasMany(() => Snapshot)
  public snapshots: HasMany<typeof Snapshot>
}
