import { DateTime } from 'luxon'
import { BaseModel, BelongsTo, belongsTo, column } from '@ioc:Adonis/Lucid/Orm'
import Artifact from 'App/Models/Artifact'
import { INetworkData, ISnapshotDataV1 } from './interfaces/SnapshotDataV1'

export default class Snapshot extends BaseModel {
  @column({ isPrimary: true })
  public id: number

  @column()
  public artifactId: number

  @column()
  public version: number

  @column()
  public data: ISnapshotDataV1

  public externalCalls: INetworkData[]

  @column.dateTime({ autoCreate: true })
  public createdAt: DateTime

  @column.dateTime({ autoCreate: true, autoUpdate: true })
  public updatedAt: DateTime

  @belongsTo(() => Artifact)
  public artifact: BelongsTo<typeof Artifact>
}
