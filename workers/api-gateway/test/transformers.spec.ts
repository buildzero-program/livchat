import { describe, it, expect } from 'vitest';
import {
  pascalToCamel,
  camelToPascal,
  toCamelCase,
  toPascalCase,
} from '../src/transformers';

describe('transformers', () => {
  describe('pascalToCamel', () => {
    it('should convert simple PascalCase', () => {
      expect(pascalToCamel('Phone')).toBe('phone');
      expect(pascalToCamel('Body')).toBe('body');
      expect(pascalToCamel('Name')).toBe('name');
    });

    it('should convert multi-word PascalCase', () => {
      expect(pascalToCamel('IsInWhatsapp')).toBe('isInWhatsapp');
      expect(pascalToCamel('VerifiedName')).toBe('verifiedName');
      expect(pascalToCamel('LinkPreview')).toBe('linkPreview');
      expect(pascalToCamel('PushName')).toBe('pushName');
    });

    it('should handle acronyms (JID, ID)', () => {
      expect(pascalToCamel('JID')).toBe('jid');
      expect(pascalToCamel('ID')).toBe('id');
    });

    it('should handle empty string', () => {
      expect(pascalToCamel('')).toBe('');
    });

    it('should handle already camelCase', () => {
      expect(pascalToCamel('phone')).toBe('phone');
      expect(pascalToCamel('isInWhatsapp')).toBe('isInWhatsapp');
    });
  });

  describe('camelToPascal', () => {
    it('should convert simple camelCase', () => {
      expect(camelToPascal('phone')).toBe('Phone');
      expect(camelToPascal('body')).toBe('Body');
      expect(camelToPascal('name')).toBe('Name');
    });

    it('should convert multi-word camelCase', () => {
      expect(camelToPascal('isInWhatsapp')).toBe('IsInWhatsapp');
      expect(camelToPascal('verifiedName')).toBe('VerifiedName');
      expect(camelToPascal('linkPreview')).toBe('LinkPreview');
    });

    it('should handle empty string', () => {
      expect(camelToPascal('')).toBe('');
    });

    it('should handle already PascalCase', () => {
      expect(camelToPascal('Phone')).toBe('Phone');
    });
  });

  describe('toCamelCase (object)', () => {
    it('should transform simple object', () => {
      const input = { Phone: '5511999999999', Body: 'Hello' };
      const expected = { phone: '5511999999999', body: 'Hello' };
      expect(toCamelCase(input)).toEqual(expected);
    });

    it('should transform nested object', () => {
      const input = {
        Phone: '5511999999999',
        ContextInfo: {
          StanzaId: 'xxx',
          Participant: 'yyy',
        },
      };
      const expected = {
        phone: '5511999999999',
        contextInfo: {
          stanzaId: 'xxx',
          participant: 'yyy',
        },
      };
      expect(toCamelCase(input)).toEqual(expected);
    });

    it('should transform array of objects', () => {
      const input = {
        Users: [
          { IsInWhatsapp: true, JID: 'xxx@s.whatsapp.net' },
          { IsInWhatsapp: false, JID: 'yyy@s.whatsapp.net' },
        ],
      };
      const expected = {
        users: [
          { isInWhatsapp: true, jid: 'xxx@s.whatsapp.net' },
          { isInWhatsapp: false, jid: 'yyy@s.whatsapp.net' },
        ],
      };
      expect(toCamelCase(input)).toEqual(expected);
    });

    it('should handle WuzAPI response format', () => {
      const input = {
        code: 200,
        success: true,
        data: {
          Details: 'Sent',
          Id: '90B2F8B13FAC8A9CF6B06E99C7834DC5',
          Timestamp: '2022-04-20T12:49:08-03:00',
        },
      };
      const expected = {
        code: 200,
        success: true,
        data: {
          details: 'Sent',
          id: '90B2F8B13FAC8A9CF6B06E99C7834DC5',
          timestamp: '2022-04-20T12:49:08-03:00',
        },
      };
      expect(toCamelCase(input)).toEqual(expected);
    });

    it('should handle null', () => {
      expect(toCamelCase(null)).toBeNull();
    });

    it('should handle undefined', () => {
      expect(toCamelCase(undefined)).toBeUndefined();
    });

    it('should preserve primitive values', () => {
      expect(toCamelCase('string')).toBe('string');
      expect(toCamelCase(123)).toBe(123);
      expect(toCamelCase(true)).toBe(true);
      expect(toCamelCase(false)).toBe(false);
    });

    it('should handle array of primitives', () => {
      const input = { Phone: ['5511999999999', '5511888888888'] };
      const expected = { phone: ['5511999999999', '5511888888888'] };
      expect(toCamelCase(input)).toEqual(expected);
    });

    it('should handle empty object', () => {
      expect(toCamelCase({})).toEqual({});
    });

    it('should handle empty array', () => {
      expect(toCamelCase([])).toEqual([]);
    });
  });

  describe('toPascalCase (object)', () => {
    it('should transform simple object', () => {
      const input = { phone: '5511999999999', body: 'Hello' };
      const expected = { Phone: '5511999999999', Body: 'Hello' };
      expect(toPascalCase(input)).toEqual(expected);
    });

    it('should transform nested object', () => {
      const input = {
        phone: '5511999999999',
        contextInfo: {
          stanzaId: 'xxx',
          participant: 'yyy',
        },
      };
      const expected = {
        Phone: '5511999999999',
        ContextInfo: {
          StanzaId: 'xxx',
          Participant: 'yyy',
        },
      };
      expect(toPascalCase(input)).toEqual(expected);
    });

    it('should transform array of phones', () => {
      const input = { phone: ['5511999999999', '5511888888888'] };
      const expected = { Phone: ['5511999999999', '5511888888888'] };
      expect(toPascalCase(input)).toEqual(expected);
    });

    it('should handle send message request', () => {
      const input = {
        phone: '5491155554444',
        body: 'Hello World',
        id: '90B2F8B13FAC8A9CF6B06E99C7834DC5',
      };
      const expected = {
        Phone: '5491155554444',
        Body: 'Hello World',
        Id: '90B2F8B13FAC8A9CF6B06E99C7834DC5',
      };
      expect(toPascalCase(input)).toEqual(expected);
    });

    it('should handle send image request', () => {
      const input = {
        phone: '5511999999999',
        caption: 'Look at this',
        image: 'data:image/jpeg;base64,xxx',
      };
      const expected = {
        Phone: '5511999999999',
        Caption: 'Look at this',
        Image: 'data:image/jpeg;base64,xxx',
      };
      expect(toPascalCase(input)).toEqual(expected);
    });

    it('should handle send location request', () => {
      const input = {
        phone: '5511999999999',
        latitude: 48.858370,
        longitude: 2.294481,
        name: 'Paris',
      };
      const expected = {
        Phone: '5511999999999',
        Latitude: 48.858370,
        Longitude: 2.294481,
        Name: 'Paris',
      };
      expect(toPascalCase(input)).toEqual(expected);
    });

    it('should handle null', () => {
      expect(toPascalCase(null)).toBeNull();
    });

    it('should handle undefined', () => {
      expect(toPascalCase(undefined)).toBeUndefined();
    });
  });

  describe('real-world WuzAPI scenarios', () => {
    it('should transform check users response', () => {
      const wuzapiResponse = {
        code: 200,
        data: {
          Users: [
            {
              IsInWhatsapp: true,
              JID: '5491155554445@s.whatsapp.net',
              Query: '5491155554445',
              VerifiedName: 'Company Name',
            },
          ],
        },
        success: true,
      };

      const expected = {
        code: 200,
        data: {
          users: [
            {
              isInWhatsapp: true,
              jid: '5491155554445@s.whatsapp.net',
              query: '5491155554445',
              verifiedName: 'Company Name',
            },
          ],
        },
        success: true,
      };

      expect(toCamelCase(wuzapiResponse)).toEqual(expected);
    });

    it('should transform group info response', () => {
      const wuzapiResponse = {
        code: 200,
        data: {
          JID: '120362023605733675@g.us',
          Name: 'Super Group',
          OwnerJID: '5491155554444@s.whatsapp.net',
          GroupCreated: '2022-04-21T17:15:26-03:00',
          IsAnnounce: false,
          IsLocked: false,
          Participants: [
            {
              JID: '5491155554444@s.whatsapp.net',
              IsAdmin: true,
              IsSuperAdmin: true,
            },
          ],
        },
        success: true,
      };

      const result = toCamelCase(wuzapiResponse) as {
        code: number;
        data: {
          jid: string;
          name: string;
          ownerJID: string;
          participants: Array<{ isAdmin: boolean }>;
        };
        success: boolean;
      };

      expect(result.data.jid).toBe('120362023605733675@g.us');
      expect(result.data.name).toBe('Super Group');
      expect(result.data.ownerJID).toBe('5491155554444@s.whatsapp.net');
      expect(result.data.participants[0].isAdmin).toBe(true);
    });

    it('should transform session status response', () => {
      const wuzapiResponse = {
        code: 200,
        data: {
          Connected: true,
          LoggedIn: true,
        },
        success: true,
      };

      const expected = {
        code: 200,
        data: {
          connected: true,
          loggedIn: true,
        },
        success: true,
      };

      expect(toCamelCase(wuzapiResponse)).toEqual(expected);
    });

    it('should transform session connect request', () => {
      const clientRequest = {
        subscribe: ['Message'],
        immediate: false,
      };

      const expected = {
        Subscribe: ['Message'],
        Immediate: false,
      };

      expect(toPascalCase(clientRequest)).toEqual(expected);
    });

    it('should transform mark read request', () => {
      const clientRequest = {
        id: ['AABBCCDD112233', 'IIOOPPLL43332'],
        chatPhone: '5491155553934',
        senderPhone: '5491155553935',
      };

      const expected = {
        Id: ['AABBCCDD112233', 'IIOOPPLL43332'],
        ChatPhone: '5491155553934',
        SenderPhone: '5491155553935',
      };

      expect(toPascalCase(clientRequest)).toEqual(expected);
    });

    it('should transform contacts list response (object keys as JIDs)', () => {
      const wuzapiResponse = {
        code: 200,
        data: {
          '5491122223333@s.whatsapp.net': {
            BusinessName: '',
            FirstName: '',
            Found: true,
            FullName: '',
            PushName: 'John',
          },
        },
        success: true,
      };

      const result = toCamelCase(wuzapiResponse) as {
        code: number;
        data: Record<string, { pushName: string; found: boolean }>;
        success: boolean;
      };

      // Keys que parecem JIDs devem ser mantidas
      expect(result.data['5491122223333@s.whatsapp.net']).toBeDefined();
      expect(result.data['5491122223333@s.whatsapp.net'].pushName).toBe('John');
      expect(result.data['5491122223333@s.whatsapp.net'].found).toBe(true);
    });

    it('should handle deeply nested structures', () => {
      const input = {
        Level1: {
          Level2: {
            Level3: {
              DeepValue: 'test',
            },
          },
        },
      };

      const expected = {
        level1: {
          level2: {
            level3: {
              deepValue: 'test',
            },
          },
        },
      };

      expect(toCamelCase(input)).toEqual(expected);
    });
  });

  describe('bidirectional transformation', () => {
    it('should be reversible for simple objects', () => {
      const original = { phone: '5511999999999', body: 'Hello' };
      const pascal = toPascalCase(original);
      const backToCamel = toCamelCase(pascal);

      expect(backToCamel).toEqual(original);
    });

    it('should be reversible for nested objects', () => {
      const original = {
        phone: '5511999999999',
        contextInfo: {
          stanzaId: 'xxx',
          participant: 'yyy',
        },
      };
      const pascal = toPascalCase(original);
      const backToCamel = toCamelCase(pascal);

      expect(backToCamel).toEqual(original);
    });
  });
});
