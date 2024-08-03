import { DateTime } from 'luxon'
import { BaseModel, column } from '@ioc:Adonis/Lucid/Orm'


export default class Identity extends BaseModel {
  @column({ isPrimary: true })
  public id: number

  @column()
  public account: string

  @column()
  public alias: string

  @column()
  public description: string

  @column()
  public discord: string

  @column()
  public domain_name: string

  @column()
  public ethereum: string

  @column()
  public github: string

  @column()
  public logo: string

  @column()
  public twitter: string

  @column()
  public website: string

  @column.dateTime({ autoCreate: true })
  public createdAt: DateTime

  @column.dateTime({ autoCreate: true, autoUpdate: true })
  public updatedAt: DateTime
}
