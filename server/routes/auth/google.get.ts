import { usePrisma } from '../../utils/prisma'

interface YouTubeMineChannelResponse {
  items?: Array<{
    id: string
    snippet: {
      title: string
      description: string
      customUrl?: string
      thumbnails?: {
        default?: { url: string }
        medium?: { url: string }
        high?: { url: string }
      }
    }
    statistics?: {
      viewCount?: string
      subscriberCount?: string
      videoCount?: string
    }
  }>
}

export default defineOAuthGoogleEventHandler({
  config: {
    scope: [
      'openid',
      'email',
      'profile',
      'https://www.googleapis.com/auth/youtube.readonly'
    ]
  },
  async onSuccess(event, { user, tokens }) {
    const prisma = usePrisma()

    let ownChannelId: string | null = null
    let channelInfo: {
      id: string
      title: string
      handle: string | null
      thumbnail: string
    } | null = null

    // Fetch the user's YouTube channel using the OAuth access token
    try {
      const ytResponse = await $fetch<YouTubeMineChannelResponse>(
        'https://www.googleapis.com/youtube/v3/channels',
        {
          params: {
            part: 'snippet,statistics',
            mine: true
          },
          headers: {
            Authorization: `Bearer ${tokens.access_token}`
          }
        }
      )

      const channelItem = ytResponse.items?.[0]
      if (channelItem) {
        ownChannelId = channelItem.id
        const thumbnail =
          channelItem.snippet.thumbnails?.medium?.url ||
          channelItem.snippet.thumbnails?.default?.url ||
          ''
        const handle = channelItem.snippet.customUrl || null

        channelInfo = {
          id: channelItem.id,
          title: channelItem.snippet.title,
          handle,
          thumbnail
        }

        // Upsert Channel record
        await prisma.channel.upsert({
          where: { id: channelItem.id },
          create: {
            id: channelItem.id,
            title: channelItem.snippet.title,
            handle,
            thumbnail
          },
          update: {
            title: channelItem.snippet.title,
            handle,
            thumbnail
          }
        })

        // Save snapshot if statistics are present
        if (channelItem.statistics) {
          try {
            await prisma.channelSnapshot.create({
              data: {
                channelId: channelItem.id,
                subscriberCount: Number(channelItem.statistics.subscriberCount || 0),
                viewCount: BigInt(channelItem.statistics.viewCount || 0),
                videoCount: Number(channelItem.statistics.videoCount || 0)
              }
            })
          } catch (snapshotErr) {
            console.error('Error saving snapshot during login:', snapshotErr)
          }
        }
      }
    } catch (ytError) {
      console.warn('Could not fetch own YouTube channel (account may have no channel created):', ytError)
    }

    // Upsert User in database
    const dbUser = await prisma.user.upsert({
      where: { id: user.sub },
      create: {
        id: user.sub,
        email: user.email,
        name: user.name || null,
        image: user.picture || null,
        ownChannelId
      },
      update: {
        email: user.email,
        name: user.name || null,
        image: user.picture || null,
        ...(ownChannelId ? { ownChannelId } : {})
      },
      include: {
        ownChannel: true
      }
    })

    // Establish secure encrypted cookie session
    await setUserSession(event, {
      user: {
        id: dbUser.id,
        email: dbUser.email,
        name: dbUser.name,
        image: dbUser.image,
        ownChannel: dbUser.ownChannel
          ? {
              id: dbUser.ownChannel.id,
              title: dbUser.ownChannel.title,
              handle: dbUser.ownChannel.handle,
              thumbnail: dbUser.ownChannel.thumbnail
            }
          : channelInfo
      }
    })

    return sendRedirect(event, '/')
  },
  onError(event, error) {
    console.error('Google OAuth Login Error:', error)
    return sendRedirect(event, '/?auth_error=failed')
  }
})
