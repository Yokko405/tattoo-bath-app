// Cloudflare WorkersでGoogle Maps APIのプロキシを作成
// APIキーをサーバー側で管理し、クライアントには公開しない

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    const path = url.pathname;
    
    // CORSヘッダーを設定
    const corsHeaders = {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type',
    };

    // OPTIONSリクエスト（プリフライト）の処理
    if (request.method === 'OPTIONS') {
      return new Response(null, {
        headers: {
          ...corsHeaders,
          'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
        },
      });
    }

    // Google Maps APIキーが設定されているか確認
    // フロントエンド用（Maps JavaScript API）とサーバーサイド用（Places API, Geocoding API）で分ける
    const frontendApiKey = env.GOOGLE_MAPS_API_KEY; // フロントエンド用（HTTPリファラー制限あり）
    const serverApiKey = env.GOOGLE_MAPS_SERVER_API_KEY || env.GOOGLE_MAPS_API_KEY; // サーバーサイド用（制限なし）
    
    if (!frontendApiKey) {
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

    // Google Maps JavaScript APIのプロキシ
    if (path === '/' || path === '/maps/js') {
      const callback = url.searchParams.get('callback') || 'initMap';
      const libraries = url.searchParams.get('libraries') || '';
      
      const mapsApiUrl = new URL('https://maps.googleapis.com/maps/api/js');
      mapsApiUrl.searchParams.set('key', frontendApiKey); // フロントエンド用APIキー
      mapsApiUrl.searchParams.set('callback', callback);
      if (libraries) {
        mapsApiUrl.searchParams.set('libraries', libraries);
      }

      try {
        const response = await fetch(mapsApiUrl.toString());
        const script = await response.text();

        return new Response(script, {
          headers: {
            ...corsHeaders,
            'Content-Type': 'application/javascript',
            'Cache-Control': 'public, max-age=3600',
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
    }

    // Geocoding APIのプロキシ
    if (path === '/geocode') {
      const address = url.searchParams.get('address');
      if (!address) {
        return new Response(
          JSON.stringify({ error: 'address parameter is required' }),
          {
            status: 400,
            headers: {
              ...corsHeaders,
              'Content-Type': 'application/json',
            },
          }
        );
      }

      const geocodeUrl = new URL('https://maps.googleapis.com/maps/api/geocode/json');
      geocodeUrl.searchParams.set('key', serverApiKey); // サーバーサイド用APIキー
      geocodeUrl.searchParams.set('address', address);
      geocodeUrl.searchParams.set('language', 'ja');

      try {
        const response = await fetch(geocodeUrl.toString());
        const data = await response.json();

        return new Response(JSON.stringify(data), {
          headers: {
            ...corsHeaders,
            'Content-Type': 'application/json',
            'Cache-Control': 'public, max-age=86400', // 24時間キャッシュ
          },
        });
      } catch (error) {
        return new Response(
          JSON.stringify({ error: 'Failed to fetch geocoding data', details: error.message }),
          {
            status: 500,
            headers: {
              ...corsHeaders,
              'Content-Type': 'application/json',
            },
          }
        );
      }
    }

    // Places API (Text Search)のプロキシ
    if (path === '/places/search') {
      const query = url.searchParams.get('query');
      if (!query) {
        return new Response(
          JSON.stringify({ error: 'query parameter is required' }),
          {
            status: 400,
            headers: {
              ...corsHeaders,
              'Content-Type': 'application/json',
            },
          }
        );
      }

      const placesUrl = new URL('https://maps.googleapis.com/maps/api/place/textsearch/json');
      placesUrl.searchParams.set('key', serverApiKey); // サーバーサイド用APIキー
      placesUrl.searchParams.set('query', query);
      placesUrl.searchParams.set('language', 'ja');

      try {
        console.log('Places API request URL:', placesUrl.toString().replace(serverApiKey, 'API_KEY_HIDDEN'));
        const response = await fetch(placesUrl.toString());
        
        if (!response.ok) {
          const errorText = await response.text();
          console.error('Places API HTTP error:', response.status, response.statusText);
          console.error('Places API error response body:', errorText);
          return new Response(
            JSON.stringify({ 
              error: 'Places API request failed', 
              status: response.status,
              statusText: response.statusText,
              details: errorText 
            }),
            {
              status: response.status,
              headers: {
                ...corsHeaders,
                'Content-Type': 'application/json',
              },
            }
          );
        }
        
        const data = await response.json();
        console.log('Places API response status:', data.status);
        console.log('Places API full response:', JSON.stringify(data, null, 2));
        
        // Google Maps APIのエラーレスポンスをチェック
        if (data.status && data.status !== 'OK' && data.status !== 'ZERO_RESULTS') {
          console.error('Places API returned error status:', data.status);
          console.error('Places API error_message:', data.error_message);
          console.error('Places API error_message (raw):', data.error_message);
          console.error('Places API full response:', JSON.stringify(data, null, 2));
          
          // エラーメッセージをより詳細に返す
          const errorMsg = data.error_message || `Places API error: ${data.status}`;
          return new Response(
            JSON.stringify({ 
              error: errorMsg,
              status: data.status,
              error_message: data.error_message,
              error_message_en: data.error_message,
              full_response: data
            }),
            {
              status: 400,
              headers: {
                ...corsHeaders,
                'Content-Type': 'application/json',
              },
            }
          );
        }

        return new Response(JSON.stringify(data), {
          headers: {
            ...corsHeaders,
            'Content-Type': 'application/json',
            'Cache-Control': 'public, max-age=3600', // 1時間キャッシュ
          },
        });
      } catch (error) {
        console.error('Places API fetch error:', error);
        return new Response(
          JSON.stringify({ error: 'Failed to fetch places data', details: error.message }),
          {
            status: 500,
            headers: {
              ...corsHeaders,
              'Content-Type': 'application/json',
            },
          }
        );
      }
    }

    // Places API (Place Details)のプロキシ
    if (path === '/places/details') {
      const placeId = url.searchParams.get('place_id');
      if (!placeId) {
        return new Response(
          JSON.stringify({ error: 'place_id parameter is required' }),
          {
            status: 400,
            headers: {
              ...corsHeaders,
              'Content-Type': 'application/json',
            },
          }
        );
      }

      const placesUrl = new URL('https://maps.googleapis.com/maps/api/place/details/json');
      placesUrl.searchParams.set('key', serverApiKey); // サーバーサイド用APIキー
      placesUrl.searchParams.set('place_id', placeId);
      placesUrl.searchParams.set('language', 'ja');
      placesUrl.searchParams.set('fields', 'opening_hours,price_level,formatted_phone_number,website');

      try {
        const response = await fetch(placesUrl.toString());
        
        if (!response.ok) {
          const errorText = await response.text();
          console.error('Place Details API error:', response.status, errorText);
          return new Response(
            JSON.stringify({ 
              error: 'Place Details API request failed', 
              status: response.status,
              details: errorText 
            }),
            {
              status: response.status,
              headers: {
                ...corsHeaders,
                'Content-Type': 'application/json',
              },
            }
          );
        }
        
        const data = await response.json();
        
        // Google Maps APIのエラーレスポンスをチェック
        if (data.status && data.status !== 'OK') {
          console.error('Place Details API returned error status:', data.status, data.error_message);
          return new Response(
            JSON.stringify({ 
              error: data.error_message || `Place Details API error: ${data.status}`,
              status: data.status
            }),
            {
              status: 400,
              headers: {
                ...corsHeaders,
                'Content-Type': 'application/json',
              },
            }
          );
        }

        return new Response(JSON.stringify(data), {
          headers: {
            ...corsHeaders,
            'Content-Type': 'application/json',
            'Cache-Control': 'public, max-age=3600', // 1時間キャッシュ
          },
        });
      } catch (error) {
        console.error('Place Details API fetch error:', error);
        return new Response(
          JSON.stringify({ error: 'Failed to fetch place details', details: error.message }),
          {
            status: 500,
            headers: {
              ...corsHeaders,
              'Content-Type': 'application/json',
            },
          }
        );
      }
    }

    // 施設データをCloudflare KVに保存
    if (path === '/facilities/save' && request.method === 'POST') {
      try {
        const body = await request.json();
        const { facilityKey, facilityData } = body;

        if (!facilityKey || !facilityData) {
          return new Response(
            JSON.stringify({ error: 'facilityKey and facilityData are required' }),
            {
              status: 400,
              headers: {
                ...corsHeaders,
                'Content-Type': 'application/json',
              },
            }
          );
        }

        // KVに保存
        if (env.FACILITIES_KV) {
          await env.FACILITIES_KV.put(facilityKey, JSON.stringify(facilityData));
        } else {
          console.warn('FACILITIES_KV is not configured');
        }

        return new Response(
          JSON.stringify({ success: true, message: 'Facility data saved' }),
          {
            headers: {
              ...corsHeaders,
              'Content-Type': 'application/json',
            },
          }
        );
      } catch (error) {
        return new Response(
          JSON.stringify({ error: 'Failed to save facility data', details: error.message }),
          {
            status: 500,
            headers: {
              ...corsHeaders,
              'Content-Type': 'application/json',
            },
          }
        );
      }
    }

    // 施設データをCloudflare KVから取得
    if (path === '/facilities/get' && request.method === 'GET') {
      try {
        const facilityKey = url.searchParams.get('key');

        if (!facilityKey) {
          return new Response(
            JSON.stringify({ error: 'key parameter is required' }),
            {
              status: 400,
              headers: {
                ...corsHeaders,
                'Content-Type': 'application/json',
              },
            }
          );
        }

        // KVから取得
        let facilityData = null;
        if (env.FACILITIES_KV) {
          const stored = await env.FACILITIES_KV.get(facilityKey);
          if (stored) {
            facilityData = JSON.parse(stored);
          }
        } else {
          console.warn('FACILITIES_KV is not configured');
        }

        return new Response(
          JSON.stringify({ success: true, data: facilityData }),
          {
            headers: {
              ...corsHeaders,
              'Content-Type': 'application/json',
            },
          }
        );
      } catch (error) {
        return new Response(
          JSON.stringify({ error: 'Failed to get facility data', details: error.message }),
          {
            status: 500,
            headers: {
              ...corsHeaders,
              'Content-Type': 'application/json',
            },
          }
        );
      }
    }

    // すべての施設データをCloudflare KVから取得
    if (path === '/facilities/get-all' && request.method === 'GET') {
      try {
        let allFacilities = {};
        
        if (env.FACILITIES_KV) {
          // KVからすべてのキーを取得
          const keys = await env.FACILITIES_KV.list();
          
          // 各キーのデータを取得
          const promises = keys.keys.map(async (key) => {
            const value = await env.FACILITIES_KV.get(key.name);
            if (value) {
              return { key: key.name, data: JSON.parse(value) };
            }
            return null;
          });
          
          const results = await Promise.all(promises);
          results.forEach((result) => {
            if (result) {
              allFacilities[result.key] = result.data;
            }
          });
        } else {
          console.warn('FACILITIES_KV is not configured');
        }

        return new Response(
          JSON.stringify({ success: true, data: allFacilities }),
          {
            headers: {
              ...corsHeaders,
              'Content-Type': 'application/json',
            },
          }
        );
      } catch (error) {
        return new Response(
          JSON.stringify({ error: 'Failed to get all facilities data', details: error.message }),
          {
            status: 500,
            headers: {
              ...corsHeaders,
              'Content-Type': 'application/json',
            },
          }
        );
      }
    }

    // デフォルト: Google Maps JavaScript API
    const callback = url.searchParams.get('callback') || 'initMap';
    const libraries = url.searchParams.get('libraries') || '';
    
    const mapsApiUrl = new URL('https://maps.googleapis.com/maps/api/js');
    mapsApiUrl.searchParams.set('key', frontendApiKey); // フロントエンド用APIキー
    mapsApiUrl.searchParams.set('callback', callback);
    if (libraries) {
      mapsApiUrl.searchParams.set('libraries', libraries);
    }

    try {
      const response = await fetch(mapsApiUrl.toString());
      const script = await response.text();

      return new Response(script, {
        headers: {
          ...corsHeaders,
          'Content-Type': 'application/javascript',
          'Cache-Control': 'public, max-age=3600',
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


