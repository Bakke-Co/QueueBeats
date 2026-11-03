import {
  AddSongRequest,
  AddSongToQueueData,
  AddSongToQueueError,
  CheckHealthData,
  CreateTestDataData,
  DebugHealthCheckData,
  DebugRequestData,
  DebugSystemInfoData,
  ExchangeCodeForTokenData,
  ExchangeCodeForTokenError,
  GetApiInfo2Data,
  GetApiInfoData,
  GetSpotifyConfigData,
  GetSupabaseClientConfig2Data,
  GetSupabaseClientConfigAltData,
  GetSupabaseClientConfigData,
  GetSupabaseConfig2Data,
  GetSupabaseConfigAltData,
  GetSupabaseConfigData,
  GetUrlInfoData,
  RefreshTokenData,
  RefreshTokenError,
  SearchSongsData,
  SearchSongsError,
  SearchSongsParams,
  SearchSpotifySongsData,
  SearchSpotifySongsError,
  SearchSpotifySongsParams,
  SetupDatabaseData,
  SpotifyAuthRequest,
  SpotifyTokenRequest,
} from "./data-contracts";
import { ContentType, HttpClient, RequestParams } from "./http-client";

export class Brain<SecurityDataType = unknown> extends HttpClient<SecurityDataType> {
  /**
   * @description Check health of application. Returns 200 when OK, 500 when not.
   *
   * @name check_health
   * @summary Check Health
   * @request GET:/_healthz
   */
  check_health = (params: RequestParams = {}) =>
    this.request<CheckHealthData, any>({
      path: `/_healthz`,
      method: "GET",
      ...params,
    });

  /**
   * @description Get API connection information. This is a simple endpoint to test API connectivity. It returns basic info about the API connection, including the detected base URL.
   *
   * @tags utils, dbtn/module:api_utils
   * @name get_api_info2
   * @summary Get Api Info2
   * @request GET:/routes/api-utils/info
   */
  get_api_info2 = (params: RequestParams = {}) =>
    this.request<GetApiInfo2Data, any>({
      path: `/routes/api-utils/info`,
      method: "GET",
      ...params,
    });

  /**
   * @description Alternate route for Supabase configuration to avoid CORS issues.
   *
   * @tags config, dbtn/module:supabase_config2
   * @name get_supabase_config_alt
   * @summary Get Supabase Config Alt
   * @request GET:/routes/api/supabase-config/
   */
  get_supabase_config_alt = (params: RequestParams = {}) =>
    this.request<GetSupabaseConfigAltData, any>({
      path: `/routes/api/supabase-config/`,
      method: "GET",
      ...params,
    });

  /**
   * @description Client-specific alternate route for Supabase configuration.
   *
   * @tags config, dbtn/module:supabase_config2
   * @name get_supabase_client_config_alt
   * @summary Get Supabase Client Config Alt
   * @request GET:/routes/api/supabase-config/client
   */
  get_supabase_client_config_alt = (params: RequestParams = {}) =>
    this.request<GetSupabaseClientConfigAltData, any>({
      path: `/routes/api/supabase-config/client`,
      method: "GET",
      ...params,
    });

  /**
   * @description Get the Supabase configuration details needed for the frontend.
   *
   * @tags config, dbtn/module:supabase2
   * @name get_supabase_config2
   * @summary Get Supabase Config2
   * @request GET:/routes/supabase-config2/
   */
  get_supabase_config2 = (params: RequestParams = {}) =>
    this.request<GetSupabaseConfig2Data, any>({
      path: `/routes/supabase-config2/`,
      method: "GET",
      ...params,
    });

  /**
   * @description Get Supabase configuration for the frontend
   *
   * @tags supabase, dbtn/module:supabase
   * @name get_supabase_client_config
   * @summary Get Supabase Client Config
   * @request GET:/routes/supabase/config
   */
  get_supabase_client_config = (params: RequestParams = {}) =>
    this.request<GetSupabaseClientConfigData, any>({
      path: `/routes/supabase/config`,
      method: "GET",
      ...params,
    });

  /**
   * @description Simple health check endpoint to verify API connectivity. Returns a success response with basic API details.
   *
   * @tags debug, dbtn/module:debug
   * @name debug_health_check
   * @summary Health check endpoint
   * @request GET:/debug/health
   */
  debug_health_check = (params: RequestParams = {}) =>
    this.request<DebugHealthCheckData, any>({
      path: `/debug/health`,
      method: "GET",
      ...params,
    });

  /**
   * @description Debug endpoint that returns detailed information about the current request. Useful for diagnosing connection and CORS issues.
   *
   * @tags debug, dbtn/module:debug
   * @name debug_request
   * @summary Request debug info
   * @request GET:/debug/request
   */
  debug_request = (params: RequestParams = {}) =>
    this.request<DebugRequestData, any>({
      path: `/debug/request`,
      method: "GET",
      ...params,
    });

  /**
   * @description Returns system information for debugging deployment environment issues.
   *
   * @tags debug, dbtn/module:debug
   * @name debug_system_info
   * @summary System debug info
   * @request GET:/debug/system
   */
  debug_system_info = (params: RequestParams = {}) =>
    this.request<DebugSystemInfoData, any>({
      path: `/debug/system`,
      method: "GET",
      ...params,
    });

  /**
   * @description Health check endpoint for the utils API
   *
   * @tags utils, dbtn/module:utils
   * @name get_api_info
   * @summary Get Api Info
   * @request GET:/routes/utils/
   */
  get_api_info = (params: RequestParams = {}) =>
    this.request<GetApiInfoData, any>({
      path: `/routes/utils/`,
      method: "GET",
      ...params,
    });

  /**
   * @description Get URL information for the API
   *
   * @tags utils, dbtn/module:utils
   * @name get_url_info
   * @summary Get Url Info
   * @request GET:/routes/utils/url-info
   */
  get_url_info = (params: RequestParams = {}) =>
    this.request<GetUrlInfoData, any>({
      path: `/routes/utils/url-info`,
      method: "GET",
      ...params,
    });

  /**
   * @description Set up the database tables and create test data.
   *
   * @tags dbtn/module:setup
   * @name setup_database
   * @summary Setup Database
   * @request POST:/routes/database
   */
  setup_database = (params: RequestParams = {}) =>
    this.request<SetupDatabaseData, any>({
      path: `/routes/database`,
      method: "POST",
      ...params,
    });

  /**
   * @description Create test data for the application.
   *
   * @tags dbtn/module:setup
   * @name create_test_data
   * @summary Create Test Data
   * @request POST:/routes/test-data
   */
  create_test_data = (params: RequestParams = {}) =>
    this.request<CreateTestDataData, any>({
      path: `/routes/test-data`,
      method: "POST",
      ...params,
    });

  /**
   * @description Search for songs on Spotify
   *
   * @tags dbtn/module:spotify_search
   * @name search_spotify_songs
   * @summary Search Spotify Songs
   * @request GET:/routes/spotify/search
   */
  search_spotify_songs = (query: SearchSpotifySongsParams, params: RequestParams = {}) =>
    this.request<SearchSpotifySongsData, SearchSpotifySongsError>({
      path: `/routes/spotify/search`,
      method: "GET",
      query: query,
      ...params,
    });

  /**
   * @description Get Spotify client ID and redirect URI
   *
   * @tags dbtn/module:spotify_auth
   * @name get_spotify_config
   * @summary Get Spotify Config
   * @request GET:/routes/spotify/config
   */
  get_spotify_config = (params: RequestParams = {}) =>
    this.request<GetSpotifyConfigData, any>({
      path: `/routes/spotify/config`,
      method: "GET",
      ...params,
    });

  /**
   * @description Exchange authorization code for access token
   *
   * @tags dbtn/module:spotify_auth
   * @name exchange_code_for_token
   * @summary Exchange Code For Token
   * @request POST:/routes/spotify/token
   */
  exchange_code_for_token = (data: SpotifyAuthRequest, params: RequestParams = {}) =>
    this.request<ExchangeCodeForTokenData, ExchangeCodeForTokenError>({
      path: `/routes/spotify/token`,
      method: "POST",
      body: data,
      type: ContentType.Json,
      ...params,
    });

  /**
   * @description Refresh an expired access token
   *
   * @tags dbtn/module:spotify_auth
   * @name refresh_token
   * @summary Refresh Token
   * @request POST:/routes/spotify/refresh
   */
  refresh_token = (data: SpotifyTokenRequest, params: RequestParams = {}) =>
    this.request<RefreshTokenData, RefreshTokenError>({
      path: `/routes/spotify/refresh`,
      method: "POST",
      body: data,
      type: ContentType.Json,
      ...params,
    });

  /**
   * @description Search for songs by title or artist
   *
   * @tags dbtn/module:songs
   * @name search_songs
   * @summary Search Songs
   * @request GET:/routes/songs/songs/search
   * @secure
   */
  search_songs = (query?: { q?: string; limit?: number }, params: RequestParams = {}) =>
    this.request<SearchSongsData, any>({
      path: `/routes/songs/songs/search`,
      method: "GET",
      query: query,
      secure: true,
      ...params,
    });

  /**
   * @description Add a song to a queue
   *
   * @tags dbtn/module:songs
   * @name add_song_to_queue
   * @summary Add Song To Queue
   * @request POST:/routes/songs/songs/add
   */
  add_song_to_queue = (data: AddSongRequest, params: RequestParams = {}) =>
    this.request<AddSongToQueueData, AddSongToQueueError>({
      path: `/routes/songs/songs/add`,
      method: "POST",
      body: data,
      type: ContentType.Json,
      ...params,
    });

  /**
   * @description Get the Supabase configuration details needed for the frontend.
   *
   * @tags config, dbtn/module:supabase_config
   * @name get_supabase_config
   * @summary Get Supabase Config
   * @request GET:/routes/supabase-config/
   */
  get_supabase_config = (params: RequestParams = {}) =>
    this.request<GetSupabaseConfigData, any>({
      path: `/routes/supabase-config/`,
      method: "GET",
      ...params,
    });

  /**
   * @description Client-specific endpoint for Supabase configuration. This is a dedicated endpoint for frontend use to reduce CORS issues.
   *
   * @tags config, dbtn/module:supabase_config
   * @name get_supabase_client_config2
   * @summary Get Supabase Client Config
   * @request GET:/routes/supabase-config/client
   * @originalName get_supabase_client_config
   * @duplicate
   */
  get_supabase_client_config2 = (params: RequestParams = {}) =>
    this.request<GetSupabaseClientConfig2Data, any>({
      path: `/routes/supabase-config/client`,
      method: "GET",
      ...params,
    });
}
