import { Bot, Context, Logger, Quester, Schema } from '@satorijs/satori'
import { HttpServer } from './http'
import { Internal } from './types'
import { LineMessageEncoder } from './message'

const logger = new Logger('line')

export class LineBot<C extends Context = Context> extends Bot<C, LineBot.Config> {
  static MessageEncoder = LineMessageEncoder
  public http: Quester
  public contentHttp: Quester
  public internal: Internal

  constructor(ctx: C, config: LineBot.Config) {
    super(ctx, config)
    if (!ctx.root.config.selfUrl) {
      logger.warn('selfUrl is not set, some features may not work')
    }

    this.platform = 'line'
    this.http = ctx.http.extend({
      ...config.api,
      headers: {
        Authorization: `Bearer ${config.token}`,
      },
    })
    this.contentHttp = ctx.http.extend({
      ...config.content,
      headers: {
        Authorization: `Bearer ${config.token}`,
      },
    })
    this.internal = new Internal(this.http)

    ctx.plugin(HttpServer, this)
  }

  // https://developers.line.biz/en/reference/messaging-api/#get-profile
  async getLogin() {
    const { userId, displayName, pictureUrl } = await this.internal.getBotInfo()
    this.user.id = userId
    this.user.name = displayName
    this.user.avatar = pictureUrl
    return this.toJSON()
  }

  async getFriendList(start?: string) {
    const { userIds, next } = await this.internal.getFollowers({
      start,
      limit: 1000,
    })
    return { data: userIds.map(v => ({ id: v, userId: v })), next }
  }

  async getGuild(guildId: string) {
    const res = await this.internal.getGroupSummary(guildId)
    return {
      id: res.groupId,
      name: res.groupName,
    }
  }

  async getGuildMemberList(guildId: string, start?: string) {
    const { memberIds, next } = await this.internal.getGroupMembersIds(guildId, { start })
    return { data: memberIds.map(id => ({ user: { id }, userId: id })), next }
  }

  async getGuildMember(guildId: string, userId: string) {
    const res = await this.internal.getGroupMemberProfile(guildId, userId)
    return {
      user: {
        id: res.userId,
        name: res.displayName,
        avatar: res.pictureUrl,
      },
      userId: res.userId,
      nickname: res.displayName,
      avatar: res.pictureUrl,
    }
  }
}

export namespace LineBot {
  export interface Config {
    token: string
    secret: string
    api: Quester.Config
    content: Quester.Config
  }

  export const Config: Schema<Config> = Schema.intersect([
    Schema.object({
      token: Schema.string().required().description('机器人令牌。'),
      secret: Schema.string().required().description('机器人密钥。'),
    }),
    Schema.object({
      api: Quester.createConfig('https://api.line.me/'),
    }),
    Schema.object({
      content: Quester.createConfig('https://api-data.line.me/'),
    }),
  ])
}
