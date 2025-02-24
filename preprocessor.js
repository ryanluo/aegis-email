import { GmailEmailDecoder } from './gmailDecoder.js';
import { readEml } from 'eml-parse-js';

class Preprocessor {
  constructor() {
  }

  /**
   * @param {Object} email - The email to process.
   * @returns {
   *  id: string,
   *  threadId: string,
   *  labelIds: string[],
   *  headers: {
   *    [key: string]: string
   *  },
   *  sender: string,
   *  subject: string,
   *  body: {
   *    plain: string,
   *    html: string
   *  },
   *  attachments: {
   *    id: string,
   *    filename: string,
   *    mimeType: string,
   *    size: number
   *  }[]
   * }
   */
  process(email) {
    throw new Error("Not implemented");
  }
}

class OutlookPreprocessor extends Preprocessor {
  constructor() {
    super();
  }

  /**
   * @param {Object} email - The email to process.
   * @returns {Object} The processed email.
   */
  process(email) {
    const processed = {
      id: email.id,
      threadId: email.conversationId,
      // TODO: Get labelIds.
      labelIds: [],
      // TODO: Get headers.
      headers: {},
      // Match google standard. Note that from is used instead of sender since sender can be a machine.
      sender: `${email.from.emailAddress.name} <${email.from.emailAddress.address}>`,
      subject: email.subject,
      body: email.body.contentType === 'text' ? {
        plain: email.body.content,
      } : {
        html: email.body.content
      },
      attachments: email.hasAttachments ? ['call listAttachments']: []
    };

    return processed;
  }
}

class GmailPreprocessor extends Preprocessor {
  constructor() {
    super();
  }

  process(email) {
    try {
      const decodedEmail = GmailEmailDecoder.decodeEmail(email.data);
      return decodedEmail;
    } catch (error) {
      throw new Error(`Failed to process email: ${error.message}`);
    }
  }
}

class EMLPreprocessor extends Preprocessor {
  constructor() {
    super();
  }

  process(eml) {
    const promise = new Promise((resolve, reject) => {
      readEml(eml, (err, emlJson) => {
        if (err) {
          reject(new Error(`Failed to process EML: ${err.message}`));
          return;
        }

        try {
          // Convert EML format to match preprocessor format
          const processed = {
            id: Date.now().toString(), // Generate a unique ID since EML doesn't have one
            threadId: '', // Does not need a threadId
            labelIds: [], // EML doesn't have labels
            headers: emlJson.headers,
            sender: emlJson.from?.email || '',
            subject: emlJson.subject || '',
            body: {
              plain: emlJson.text || '',
              html: emlJson.html || ''
            },
            attachments: (emlJson.attachments || []).map(att => ({
              id: att.id || '',
              filename: att.name || '',
              mimeType: att.contentType || '',
              size: att.data64?.length || 0
            }))
          };

          resolve(processed);
        } catch (error) {
          reject(new Error(`Failed to process EML structure: ${error.message}`));
        }
      });
    });
    return promise.then(result => { return result; });
  }
}

export {
  Preprocessor,
  GmailPreprocessor,
  EMLPreprocessor,
  OutlookPreprocessor
};