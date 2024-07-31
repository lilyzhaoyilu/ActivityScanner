import axios from 'axios';
import auth from './auth.js';

const headers = {
  'Authorization': `Bot ${auth.khltoken}`,
  'Content-Type': 'application/json',
};


export class GuildScan {

  /** Voice channels -> user ids */

  // voiceChannelsIds // string[];
  // userIdsInVoiceChannels // string[];


  constructor() {
  }


  async run() {
    try {
      const voiceChannelIds = await this.getVoiceChannelIdsFromGuild(auth.targetGuild);
      const userIdToNickname = await this.getUserListsFromChannels(voiceChannelIds);
      return userIdToNickname;
    } catch (err) {
      console.log('err in run', err);
      return new Map();
    }
  }

  async getVoiceChannelIdsFromGuild(guildId) {

    let pageTotal = 1;
    const requests = [];
    let channelRes = [];

    try {
      const initialRes = await axios.get(`https://www.kookapp.cn/api/v3/channel/list?guild_id=${guildId}&page=1`, { headers });
      if (initialRes.status === 200 && initialRes.data?.data?.items) {
        channelRes = channelRes.concat(initialRes.data.data.items);
      }
      pageTotal = initialRes.data?.data?.meta?.page_total !== undefined ? initialRes.data.data.meta.page_total : 1;
    } catch (err) {
      console.log(`Error: getAllChannelsFromGuild: `, err);
    }

    if (!pageTotal || pageTotal === 1) {
      return this.filterVoiceChannelId(channelRes);
    }

    for (let page = 2; page <= pageTotal; page++) {
      requests.push(axios.get(`https://www.kookapp.cn/api/v3/channel/list?guild_id=${guildId}&page=${page}`, { headers }))
    }


    try {
      const result = await Promise.allSettled(requests);

      for (const r of result) {
        if (r.status === 'fulfilled' && r.value?.data?.data?.items) {
          channelRes = channelRes.concat(r.value.data.data.items);
        }
      }
    } catch (err) {
      console.log(`Error: getAllChannelsFromGuild: `, err);
    }
    return this.filterVoiceChannelId(channelRes);
  }

  filterVoiceChannelId(channelList) {
    const res = [];
    for (const channel of channelList) {
      // TODO: add error handling for channel.type == 2 but channel.id missing
      if (channel.type == 2 && channel.id !== undefined) {
        res.push(`${channel.id}`);
      }
    }
    return res;
  }

  async getUserListsFromChannels(voiceChannelIds) {
    const idToNickName = new Map();
    try {
      const request = voiceChannelIds.map(id => axios.get(`https://www.kookapp.cn/api/v3/channel/user-list?channel_id=${id}`, { headers }));
      const results = await Promise.allSettled(request);

      const successfulResponses = results.map((result) => {
        if (result.status === 'fulfilled') {
          return result.value;
        }
      });

      // Process successful responses
      successfulResponses.forEach(response => {
        for (const user of response.data.data) {
          if (user.id && (user.nickname || user.username)) {
            idToNickName.set(user.id, (user.nickname || user.username));
          }
        }
      });
      return idToNickName;
    } catch (error) {
      console.error('An unexpected error occurred:', error);
    }
  }
}

