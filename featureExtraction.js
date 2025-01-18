import { NodeHtmlMarkdown } from 'node-html-markdown';
import * as htmlparser2 from "htmlparser2";

class FeatureExtractor {
  constructor() {
    this.nhm = new NodeHtmlMarkdown(
      /* options (optional) */ {}, 
      /* customTransformers (optional) */ undefined,
      /* customCodeBlockTranslators (optional) */ undefined
    );
  }

  extractSender(email) {
    return email.sender;
  }

  extractSubject(email) {
    return email.subject;
  }

  extractMarkdown(email) {
    if (!email.body.html) {
      return email.body.plain;
    }
    return this.nhm.translate(email.body.html);
  }

  extractTagSequence(email) {
    if (!email.body.html) {
      return [];
    }
    const sequence = [];
    let position = 0;

    // Create parser instance
    const parser = new htmlparser2.Parser({
        onopentag(name, attributes) {
            sequence.push({
                tag: name,
                position: position++,
                attributes: Object.entries(attributes).map(([name, value]) => ({
                    name,
                    value
                }))
            });
        }
    }, {
        decodeEntities: true,
        recognizeSelfClosing: true
    });

    // Parse the HTML content
    parser.write(email.body.html);
    parser.end();

    return sequence;
  }

  extractFeatures(email) {
    return {
      tagSequence: this.extractTagSequence(email),
      markdown: this.extractMarkdown(email),
      sender: this.extractSender(email),
      subject: this.extractSubject(email),
    };
  }

  extractMetaFeatures(features) {
    const context = `${features.sender} ${features.subject} ${features.markdown}`;
    return {
      context,
      truncatedContext: context.length > 512 ? context.slice(0, 512) : context
    }
  }

  // Main entry point for feature extraction.
  extract(email) {
    const features = this.extractFeatures(email);
    const metaFeatures = this.extractMetaFeatures(features);
    return {...features, ...metaFeatures};
  }
}

export {
  FeatureExtractor
};