import { Handler } from '@netlify/functions';

// Interface mapping for Airtable
interface AirtableRecord {
  id?: string;
  fields: Record<string, any>;
}

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
async function getAllAirtableRecords(baseId: string, tableName: string, token: string, filterByFormula?: string) {
  let records: any[] = [];
  let offset = '';
  
  do {
    let url = `https://api.airtable.com/v0/${baseId}/${encodeURIComponent(tableName)}`;
    const params: string[] = [];
    
    if (offset) {
      params.push(`offset=${offset}`);
    }
    if (filterByFormula) {
      params.push(`filterByFormula=${encodeURIComponent(filterByFormula)}`);
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
  const mainTable = process.env.AIRTABLE_TABLE || 'sesión de soporte extracorpóreo';

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

  if (!token || !baseId) {
    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({
        error: 'Falta configurar las variables de entorno AIRTABLE_TOKEN o AIRTABLE_BASE_ID en Netlify.',
      }),
    };
  }

  try {
    const method = event.httpMethod;
    const query = event.queryStringParameters || {};
    const type = query.type || 'patients'; // 'patients' or 'users'
    
    // Determine target table.
    // For patients, always use AIRTABLE_TABLE.
    // For users, we can use a separate table "usuarios" or fallback to AIRTABLE_TABLE.
    let targetTable = mainTable;
    let isUserTable = false;

    if (type === 'users') {
      targetTable = 'usuarios';
      isUserTable = true;
    }

    // Helper to try Airtable query on a specific table, and fall back if needed.
    const safeGetAllRecords = async () => {
      try {
        return await getAllAirtableRecords(baseId, targetTable, token);
      } catch (err: any) {
        // If users table is queried but fails, fall back to mainTable with a recordType filter
        if (isUserTable) {
          console.log(`Table 'usuarios' not found or error. Storing/reading users in main table: ${mainTable}`);
          targetTable = mainTable;
          // Filter by recordType = 'user'
          return await getAllAirtableRecords(baseId, mainTable, token, "{recordType} = 'user'");
        }
        throw err;
      }
    };

    if (method === 'GET') {
      const records = await safeGetAllRecords();
      
      // If we are listing users and none exist yet, seed them!
      if (type === 'users' && records.length === 0) {
        const defaultUsers = [
          { id: 'u1', username: 'admin', role: 'ADMIN', name: 'Dr. Administrador', password: '1234', recordType: 'user' },
          { id: 'u2', username: 'user', role: 'USER', name: 'Lic. Enfermería', password: '1234', recordType: 'user' },
          { id: 'u3', username: 'medico', role: 'USER', name: 'Dr. Guardia', password: '1234', recordType: 'user' }
        ];

        // Seed them in Airtable
        const createdUsers: any[] = [];
        for (const user of defaultUsers) {
          try {
            const created = await airtableRequest('POST', baseId, targetTable, token, { fields: user });
            createdUsers.push(created);
          } catch (e) {
            console.error('Error seeding user:', e);
          }
        }
        
        return {
          statusCode: 200,
          headers,
          body: JSON.stringify(createdUsers),
        };
      }

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
      const customId = data.id;

      if (type === 'users') {
        targetTable = 'usuarios';
        isUserTable = true;
      }

      // Check if record with this customId already exists to do an update or create
      let existingRecord: any = null;
      try {
        const records = await safeGetAllRecords();
        existingRecord = records.find((r: any) => r.fields.id === customId);
      } catch (err) {
        // Fallback checks already handled in safeGetAllRecords
      }

      // Ensure recordType is set appropriately when sharing table
      if (targetTable === mainTable) {
        data.recordType = type === 'users' ? 'user' : 'patient';
      }

      if (existingRecord) {
        // Update existing record
        const responseData = await airtableRequest('PATCH', baseId, targetTable, token, { fields: data }, existingRecord.id);
        return {
          statusCode: 200,
          headers,
          body: JSON.stringify(responseData),
        };
      } else {
        // Create new record
        const responseData = await airtableRequest('POST', baseId, targetTable, token, { fields: data });
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

      if (type === 'users') {
        targetTable = 'usuarios';
        isUserTable = true;
      }

      // Find record to update
      const records = await safeGetAllRecords();
      const existingRecord = records.find((r: any) => r.fields.id === customId);

      if (!existingRecord) {
        return {
          statusCode: 404,
          headers,
          body: JSON.stringify({ error: `No se encontró ningún registro con ID ${customId}` }),
        };
      }

      const responseData = await airtableRequest('PATCH', baseId, targetTable, token, { fields: data }, existingRecord.id);
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

      if (type === 'users') {
        targetTable = 'usuarios';
        isUserTable = true;
      }

      const records = await safeGetAllRecords();
      const existingRecord = records.find((r: any) => r.fields.id === customId);

      if (!existingRecord) {
        return {
          statusCode: 404,
          headers,
          body: JSON.stringify({ error: `No se encontró ningún registro con ID ${customId}` }),
        };
      }

      await airtableRequest('DELETE', baseId, targetTable, token, undefined, existingRecord.id);
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
