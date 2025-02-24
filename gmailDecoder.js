import { Base64 } from 'js-base64';

class GmailEmailDecoder {
  /**
   * Decodes a Gmail API message into a readable format
   * @param {Object} message - Raw message from Gmail API
   * @returns {Object} Decoded email with headers, body, and attachments
   */
  static decodeEmail(message) {
    try {
      const decodedEmail = {
        id: message.id,
        date: new Date(Number(message.internalDate)).toISOString(),
        threadId: message.threadId,
        labelIds: message.labelIds || [],
        headers: {},
        sender: '',
        subject: '',
        body: {
          plain: '',
          html: ''
        },
        attachments: []
      };

      // Process headers
      if (message.payload.headers) {
        message.payload.headers.forEach(header => {
          const headerName = header.name.toLowerCase();
          decodedEmail.headers[headerName] = header.value;
          
          // Explicitly parse sender and subject
          if (headerName === 'from') {
            decodedEmail.sender = header.value;
          } else if (headerName === 'subject') {
            decodedEmail.subject = header.value;
          }
        });
      }

      // Process parts recursively
      if (message.payload.parts) {
        this.decodeParts(message.payload.parts, decodedEmail);
      } else {
        // Handle messages with no parts (plain messages)
        this.decodeBody(message.payload, decodedEmail);
      }

      return decodedEmail;
    } catch (error) {
      throw new Error(`Failed to decode email: ${error.message}`);
    }
  }

  /**
   * Recursively processes message parts
   * @param {Array} parts - Message parts from Gmail API
   * @param {Object} decodedEmail - Object to store decoded email data
   */
  static decodeParts(parts, decodedEmail) {
    parts.forEach(part => {
      if (part.parts) {
        // Recursive call for nested parts
        this.decodeParts(part.parts, decodedEmail);
      } else {
        // Process individual part
        this.decodeBody(part, decodedEmail);
      }
    });
  }

  /**
   * Decodes message body based on MIME type
   * @param {Object} part - Message part to decode
   * @param {Object} decodedEmail - Object to store decoded email data
   */
  static decodeBody(part, decodedEmail) {
    const mimeType = part.mimeType;
    const body = part.body;

    if (!body) return;

    if (body.attachmentId) {
      // Handle attachment
      decodedEmail.attachments.push({
        id: body.attachmentId,
        filename: part.filename,
        mimeType: mimeType,
        size: body.size
      });
    } else if (body.data) {
      // Decode message content
      const content = Base64.decode(body.data.replace(/-/g, '+').replace(/_/g, '/'));
      switch (mimeType) {
        case 'text/plain':
          decodedEmail.body.plain += content;
          break;
        case 'text/html':
          decodedEmail.body.html += content;
          break;
      }
    }
  }
}

export {
  GmailEmailDecoder,
};