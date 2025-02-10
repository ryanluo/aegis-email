import { NodeHtmlMarkdown } from 'node-html-markdown';
import * as htmlparser2 from "htmlparser2";
import { pipeline } from '@xenova/transformers';

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
    let context = `${features.sender} ${features.subject} ${features.markdown}`;
    // Remove excess whitespace by replacing multiple whitespace characters with a single space and trimming.
    context = context.replace(/\s+/g, ' ').trim();
    return {
      context,
      truncatedContext: context.length > 512 ? context.slice(0, 512) : context
    };
  }

  // Main entry point for feature extraction.
  extract(email) {
    const features = this.extractFeatures(email);
    const metaFeatures = this.extractMetaFeatures(features);
    return {...features, ...metaFeatures};
  }
}

// untested
async function runNER(text) {
  // Load the token-classification pipeline with the bert-base-NER model.
  // We pass an options object to have the tokenizer return offset mappings,
  // though in this example they come back as null so we need to detokenize using the tokens.
  const ner = await pipeline(
    'token-classification', 
    'Xenova/bert-base-NER', 
    { tokenizerOptions: { return_offsets_mapping: true } }
  );

  // Run the NER pipeline on the provided text using an aggregation strategy that groups tokens.
  const entities = await ner(text);

  // Log the extracted entities.
  console.log("Named Entities:", entities);

  // Group consecutive PERSON tokens:
  const personEntities = [];
  let i = 0;
  while (i < entities.length) {
    if (entities[i].entity === "B-PER") {
      const tokens = [];
      // Collect the tokens in this person group.
      tokens.push(entities[i].word);
      i++;
      while (i < entities.length && (entities[i].entity === "I-PER" || entities[i].entity === "B-PER")) {
        tokens.push(entities[i].word);
        i++;
      }
      // Detokenize tokens according to wordpiece rules.
      // For example, for tokens ["Angela", "Me", "##rk", "##el"], we reconstruct "Angela Merkel".
      let personName = tokens[0];
      for (let j = 1; j < tokens.length; j++) {
        if (tokens[j].startsWith("##")) {
          personName += tokens[j].substring(2);
        } else {
          personName += " " + tokens[j];
        }
      }
      personEntities.push(personName);
    } else {
      i++;
    }
  }
  
  // Since we are not given valid character offsets (start/end are null),
  // we'll replace the identified person names in the original text.
  let modifiedText = text;

  // Utility: escape any RegExp special characters in the person name string.
  function escapeRegExp(string) {
    return string.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  }

  // Replace each person entity with "[PER]".
  // Using a simple loop, we create a regex for each detected person name.
  personEntities.forEach(personName => {
    const regex = new RegExp(escapeRegExp(personName), "g");
    modifiedText = modifiedText.replace(regex, "[PER]");
  });
  
  // Log the modified text.
  console.log("Modified Text:", modifiedText);
}

export {
  FeatureExtractor
};