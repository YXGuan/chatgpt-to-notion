// Local-only build: the upstream implementation exchanged credentials with a
// third-party server that stored Notion access tokens. We no longer do that.
// The integration token is pasted by the user in the Settings popup.
export const getToken = async (_: GetTokenParams) => {
  return {
    token: null,
    isPremium: false,
    activeTrial: false,
    trial_end: 0
  }
}

type GetTokenParams = {
  workspace_id: string
  user_id: string
}
