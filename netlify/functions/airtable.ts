import { Handler } from '@netlify/functions';

// Native fetch helper for Airtable API
async function airtableRequest(
  method: string,
  baseId: string,
  tableName: string,
  token: string,
  body?: any,
  recordId?: string
) {
  const url = `https://api.airtable.com/v0/${baseId}/${encodeURIComponent(tableName)}${recordId ? `/${recordId}` : ''}`;
  const headers: Record<string, string> = {
    'Authorization': `Bearer ${token}`,
  };

  if (body) {
    headers['Content-Type'] = 'application/json';
  }

  const options: RequestInit = {
    method,
    headers,
    body: body ? JSON.stringify(body) : undefined,
  };

  const response = await fetch(url, options);
  
  if (!response.ok) {
    const text = await response.text();
    throw new Error(`Airtable API error [${response.status}]: ${text}`);
  }

  return response.json();
}

// Fetch all records with pagination support
async function getAllAirtableRecords(baseId: string, tableName: string, token: string) {
  let records: any[] = [];
  let offset = '';
  
  do {
    let url = `https://api.airtable.com/v0/${baseId}/${encodeURIComponent(tableName)}`;
    const params: string[] = [];
    
    if (offset) {
      params.push(`offset=${offset}`);
    }
    
    if (params.length > 0) {
      url += `?${params.join('&')}`;
    }

    const response = await fetch(url, {
      headers: {
        'Authorization': `Bearer ${token}`,
      }
    });

    if (!response.ok) {
      const text = await response.text();
      throw new Error(`Airtable GET error [${response.status}]: ${text}`);
    }

    const data = await response.json();
    records = records.concat(data.records || []);
    offset = data.offset || '';
  } while (offset);

  return records;
}

export const handler: Handler = async (event, context) => {
  const token = process.env.AIRTABLE_TOKEN;
  const baseId = process.env.AIRTABLE_BASE_ID;
  const mainTable = process.env.AIRTABLE_TABLE;

  // Enable CORS
  const headers = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    'Access-Control-Allow-Methods': 'GET, POST, PATCH, DELETE, OPTIONS',
    'Content-Type': 'application/json',
  };

  if (event.httpMethod === 'OPTIONS') {
    return { statusCode: 200, headers, body: '' };
  }

  // Temporary logs for debugging (never print the token itself)
  console.log("BASE:", baseId);
  console.log("TABLE:", mainTable);
  console.log("TOKEN:", token ? "OK" : "MISSING");

  // Validate presence of all three Airtable environment variables
  if (!token || !baseId || !mainTable) {
    const missing: string[] = [];
    if (!token) missing.push('AIRTABLE_TOKEN');
    if (!baseId) missing.push('AIRTABLE_BASE_ID');
    if (!mainTable) missing.push('AIRTABLE_TABLE');
    
    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({
        error: `Faltan las siguientes variables de entorno de Airtable: ${missing.join(', ')}`,
      }),
    };
  }

  try {
    const method = event.httpMethod;
    const query = event.queryStringParameters || {};

    if (method === 'GET') {
      const records = await getAllAirtableRecords(baseId, mainTable, token);
      return {
        statusCode: 200,
        headers,
        body: JSON.stringify(records),
      };
    }

    if (method === 'POST') {
      if (!event.body) {
        return { statusCode: 400, headers, body: JSON.stringify({ error: 'Falta el cuerpo de la solicitud' }) };
      }
      
      const payload = JSON.parse(event.body);
      const data = payload.data || {};
      const customId = payload.id || data.id;

      // Check if record with this customId already exists to do an update or create
      let existingRecord: any = null;
      try {
        const records = await getAllAirtableRecords(baseId, mainTable, token);
        existingRecord = records.find((r: any) => r.fields.id === customId);
      } catch (err) {
        console.error('Error listing records for existence check:', err);
      }

      if (existingRecord) {
        // Update existing record
        const responseData = await airtableRequest('PATCH', baseId, mainTable, token, { fields: data }, existingRecord.id);
        return {
          statusCode: 200,
          headers,
          body: JSON.stringify(responseData),
        };
      } else {
        // Create new record
        const responseData = await airtableRequest('POST', baseId, mainTable, token, { fields: data });
        return {
          statusCode: 200,
          headers,
          body: JSON.stringify(responseData),
        };
      }
    }

    if (method === 'PATCH') {
      if (!event.body) {
        return { statusCode: 400, headers, body: JSON.stringify({ error: 'Falta el cuerpo de la solicitud' }) };
      }

      const payload = JSON.parse(event.body);
      const data = payload.data || {};
      const customId = payload.id;

      // Find record to update
      const records = await getAllAirtableRecords(baseId, mainTable, token);
      const existingRecord = records.find((r: any) => r.fields.id === customId);

      if (!existingRecord) {
        return {
          statusCode: 404,
          headers,
          body: JSON.stringify({ error: `No se encontró ningún registro con ID ${customId}` }),
        };
      }

      const responseData = await airtableRequest('PATCH', baseId, mainTable, token, { fields: data }, existingRecord.id);
      return {
        statusCode: 200,
        headers,
        body: JSON.stringify(responseData),
      };
    }

    if (method === 'DELETE') {
      const customId = query.id;
      if (!customId) {
        return { statusCode: 400, headers, body: JSON.stringify({ error: 'Falta el parámetro id' }) };
      }

      const records = await getAllAirtableRecords(baseId, mainTable, token);
      const existingRecord = records.find((r: any) => r.fields.id === customId);

      if (!existingRecord) {
        return {
          statusCode: 404,
          headers,
          body: JSON.stringify({ error: `No se encontró ningún registro con ID ${customId}` }),
        };
      }

      await airtableRequest('DELETE', baseId, mainTable, token, undefined, existingRecord.id);
      return {
        statusCode: 200,
        headers,
        body: JSON.stringify({ success: true, message: 'Registro eliminado correctamente de Airtable' }),
      };
    }

    return {
      statusCode: 405,
      headers,
      body: JSON.stringify({ error: `Método ${method} no permitido` }),
    };

  } catch (error: any) {
    console.error('Airtable execution error:', error);
    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({
        error: 'Error al comunicarse con Airtable: ' + (error.message || error),
      }),
    };
  }
};
