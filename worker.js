// Cloudflare WorkersでGoogle Maps APIのプロキシを作成
// APIキーをサーバー側で管理し、クライアントには公開しない

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    
    // CORSヘッダーを設定
    const corsHeaders = {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type',
    };

    // OPTIONSリクエスト（プリフライト）の処理
    if (request.method === 'OPTIONS') {
      return new Response(null, {
        headers: corsHeaders,
      });
    }

    // Google Maps APIキーが設定されているか確認
    if (!env.GOOGLE_MAPS_API_KEY) {
      return new Response(
        JSON.stringify({ error: 'Google Maps API key not configured' }),
        {
          status: 500,
          headers: {
            ...corsHeaders,
            'Content-Type': 'application/json',
          },
        }
      );
    }

    // Google Maps JavaScript APIのURLを構築
    // クライアントからはcallbackパラメータのみを受け取る
    const callback = url.searchParams.get('callback') || 'initMap';
    const libraries = url.searchParams.get('libraries') || '';
    
    const mapsApiUrl = new URL('https://maps.googleapis.com/maps/api/js');
    mapsApiUrl.searchParams.set('key', env.GOOGLE_MAPS_API_KEY);
    mapsApiUrl.searchParams.set('callback', callback);
    if (libraries) {
      mapsApiUrl.searchParams.set('libraries', libraries);
    }

    try {
      // Google Maps APIにリクエストを転送
      const response = await fetch(mapsApiUrl.toString());
      const script = await response.text();

      // レスポンスを返す（JavaScriptとして）
      return new Response(script, {
        headers: {
          ...corsHeaders,
          'Content-Type': 'application/javascript',
          'Cache-Control': 'public, max-age=3600', // 1時間キャッシュ
        },
      });
    } catch (error) {
      return new Response(
        JSON.stringify({ error: 'Failed to fetch Google Maps API', details: error.message }),
        {
          status: 500,
          headers: {
            ...corsHeaders,
            'Content-Type': 'application/json',
          },
        }
      );
    }
  },
};


