import { FeatureExtractor } from './index.js';
import { GmailPreprocessor } from './index.js';
import { GmailEmailDecoder } from './gmailDecoder.js';
import { EMLPreprocessor } from './index.js';
import { Base64 } from 'js-base64';

// Test suite
const runTests = async () => {
  console.log('Starting tests...\n');
  let passedTests = 0;
  let totalTests = 0;

  // Helper function to run individual tests
  const test = async (testName, testFn) => {
    totalTests++;
    try {
      await testFn();
      console.log(`✅ PASS: ${testName}`);
      passedTests++;
    } catch (error) {
      console.log(`❌ FAIL: ${testName}`);
      console.error(`   Error: ${error.message}`);
    }
  };

  // Helper function to assert equality
  const assertEqual = (actual, expected) => {
    const actualStr = JSON.stringify(actual);
    const expectedStr = JSON.stringify(expected);
    if (actualStr !== expectedStr) {
      throw new Error(`Expected ${expectedStr}, but got ${actualStr}`);
    }
  };

  // Helper function to assert partial equality
  const partialEqual = (actual, expected) => {
    for (const [key, value] of Object.entries(expected)) {
      const actualValue = actual[key];
      const actualValueStr = JSON.stringify(actualValue);
      const expectedValueStr = JSON.stringify(value);
      
      if (actualValueStr !== expectedValueStr) {
        throw new Error(
          `partialEqual failure: Expected ${key} to be ${expectedValueStr}, but got ${actualValueStr}`
        );
      }
    }
  };

  // Add separator function
  const printTestSeparator = (className) => {
    console.log('\n' + '='.repeat(50));
    console.log(`Testing ${className}`);
    console.log('='.repeat(50) + '\n');
  };

  // Before Gmail Decoder tests
  printTestSeparator('GmailEmailDecoder');

  await test('should decode a complete email with headers, body and attachments', async () => {
    const mockMessage = {
      id: 'test123',
      threadId: 'thread123',
      labelIds: ['INBOX', 'UNREAD'],
      payload: {
        headers: [
          { name: 'From', value: 'sender@example.com' },
          { name: 'Subject', value: 'Test Email' },
          { name: 'To', value: 'recipient@example.com' }
        ],
        parts: [
          {
            mimeType: 'text/plain',
            body: { data: Base64.encode('This is the plain text content') }
          },
          {
            mimeType: 'text/html',
            body: { data: Base64.encode('<p>This is the HTML content</p>') }
          },
          {
            mimeType: 'application/pdf',
            filename: 'test.pdf',
            body: { attachmentId: 'att123', size: 12345 }
          }
        ]
      }
    };

    const decodedEmail = GmailEmailDecoder.decodeEmail(mockMessage);
    assertEqual(decodedEmail, {
      id: 'test123',
      threadId: 'thread123',
      labelIds: ['INBOX', 'UNREAD'],
      headers: {
        from: 'sender@example.com',
        subject: 'Test Email',
        to: 'recipient@example.com'
      },
      sender: 'sender@example.com',
      subject: 'Test Email',
      body: {
        plain: 'This is the plain text content',
        html: '<p>This is the HTML content</p>'
      },
      attachments: [
        {
          id: 'att123',
          filename: 'test.pdf',
          mimeType: 'application/pdf',
          size: 12345
        }
      ]
    });
  });

  await test('should handle email with no parts', async () => {
    const mockMessage = {
      id: 'test123',
      threadId: 'thread123',
      labelIds: ['INBOX'],
      payload: {
        headers: [
          { name: 'Subject', value: 'Simple Email' }
        ],
        mimeType: 'text/plain',
        body: { data: Base64.encode('Simple plain text message') }
      }
    };

    const decodedEmail = GmailEmailDecoder.decodeEmail(mockMessage);
    assertEqual(decodedEmail, {
      id: 'test123',
      threadId: 'thread123',
      labelIds: ['INBOX'],
      headers: { subject: 'Simple Email' },
      sender: '',
      subject: 'Simple Email',
      body: {
        plain: 'Simple plain text message',
        html: ''
      },
      attachments: []
    });
  });

  await test('should handle email with nested parts', async () => {
    const mockMessage = {
      id: 'test123',
      threadId: 'thread123',
      payload: {
        headers: [],
        parts: [{
          parts: [
            {
              mimeType: 'text/plain',
              body: { data: Base64.encode('Nested plain text') }
            },
            {
              mimeType: 'text/html',
              body: { data: Base64.encode('<p>Nested HTML</p>') }
            }
          ]
        }]
      }
    };

    const decodedEmail = GmailEmailDecoder.decodeEmail(mockMessage);
    assertEqual(decodedEmail.body, {
      plain: 'Nested plain text',
      html: '<p>Nested HTML</p>'
    });
  });

  await test('should handle errors gracefully', async () => {
    const mockMessage = {
      id: 'test123',
      payload: null
    };

    try {
      GmailEmailDecoder.decodeEmail(mockMessage);
      throw new Error('Should have thrown an error');
    } catch (error) {
      if (!error.message.includes('Failed to decode email')) {
        throw new Error(`Expected 'Failed to decode email' error but got: ${error.message}`);
      }
    }
  });

  await test('should handle missing or empty fields', async () => {
    const mockMessage = {
      id: 'test123',
      payload: {
        headers: [],
        parts: []
      }
    };

    const decodedEmail = GmailEmailDecoder.decodeEmail(mockMessage);
    assertEqual(decodedEmail, {
      id: 'test123',
      threadId: undefined,
      labelIds: [],
      headers: {},
      sender: '',
      subject: '',
      body: {
        plain: '',
        html: ''
      },
      attachments: []
    });
  });

  await test('should correctly parse sender and subject from headers', async () => {
    const mockMessage = {
      id: 'test123',
      payload: {
        headers: [
          { name: 'From', value: 'John Doe <john@example.com>' },
          { name: 'Subject', value: 'Important Meeting' },
          { name: 'Date', value: '2024-03-14' }
        ]
      }
    };

    const decodedEmail = GmailEmailDecoder.decodeEmail(mockMessage);
    if (decodedEmail.sender !== 'John Doe <john@example.com>') {
      throw new Error('Incorrect sender');
    }
    if (decodedEmail.subject !== 'Important Meeting') {
      throw new Error('Incorrect subject');
    }
    if (decodedEmail.headers.date !== '2024-03-14') {
      throw new Error('Incorrect date');
    }
  });

  // Before FeatureExtractor tests
  printTestSeparator('FeatureExtractor');

  await test('FeatureExtractor initialization', async () => {
    const extractor = new FeatureExtractor();
    if (!extractor) throw new Error('Failed to initialize FeatureExtractor');
  });

  await test('FeatureExtractor extracts features from email', async () => {
    const extractor = new FeatureExtractor();
    const sampleEmail = {
      subject: 'Test Email',
      sender: 'test@example.com',
      body: {
        plain: 'This is a test email body',
        html: '<div>This is a <b>test</b> email body</div>'
      }
    };
    
    const features = await extractor.extract(sampleEmail);
    
    // Check structure of extracted features
    assertEqual(features, {
      tagSequence: [
        { tag: 'div', position: 0, attributes: [] },
        { tag: 'b', position: 1, attributes: [] }
      ],
      markdown: 'This is a **test** email body',
      sender: 'test@example.com',
      subject: 'Test Email',
      context: 'test@example.com Test Email This is a **test** email body',
      truncatedContext: 'test@example.com Test Email This is a **test** email body'
    });
  });

  await test('FeatureExtractor should extract tag sequence and markdown from HTML', async () => {
    const extractor = new FeatureExtractor();
    const email = {
      body: {
        html: `
          <html>
            <head><title>My Page</title></head>
            <body>
              <div class="container">
                <h1>Hello World</h1>
                <p>This is a <strong>test</strong> paragraph.</p>
              </div>
            </body>
          </html>
        `
      }
    };

    const result = await extractor.extract(email);
    
    assertEqual(result.tagSequence, [
      { tag: 'html', position: 0, attributes: [] },
      { tag: 'head', position: 1, attributes: [] },
      { tag: 'title', position: 2, attributes: [] },
      { tag: 'body', position: 3, attributes: [] },
      { tag: 'div', position: 4, attributes: [{ name: 'class', value: 'container' }] },
      { tag: 'h1', position: 5, attributes: [] },
      { tag: 'p', position: 6, attributes: [] },
      { tag: 'strong', position: 7, attributes: [] }
    ]);

    assertEqual(result.markdown, '# Hello World\n\nThis is a **test** paragraph.');
  });

  await test('FeatureExtractor should handle empty HTML', async () => {
    const extractor = new FeatureExtractor();
    const email = {
      body: { plain: '' },
      sender: 'test@example.com',
      subject: 'Test Subject'
    };

    const result = await extractor.extract(email);
    
    assertEqual(result.tagSequence, []);
    assertEqual(result.markdown, '');
    assertEqual(result.sender, 'test@example.com');
    assertEqual(result.subject, 'Test Subject');
  });

  await test('FeatureExtractor should handle complex nested HTML', async () => {
    const extractor = new FeatureExtractor();
    const email = {
      body: {
        html: `
          <body>
            <div>
              <header>
                <nav>
                  <ul>
                    <li><a href="#">Link 1</a></li>
                    <li><a href="#">Link 2</a></li>
                  </ul>
                </nav>
              </header>
              <main>
                <article>
                  <h1>Title</h1>
                  <p>Content</p>
                </article>
              </main>
            </div>
          </body>
        `
      },
      sender: 'test@example.com',
      subject: 'Test Subject'
    };

    const result = await extractor.extract(email);
    
    assertEqual(result.tagSequence, [
      { tag: 'body', position: 0, attributes: [] },
      { tag: 'div', position: 1, attributes: [] },
      { tag: 'header', position: 2, attributes: [] },
      { tag: 'nav', position: 3, attributes: [] },
      { tag: 'ul', position: 4, attributes: [] },
      { tag: 'li', position: 5, attributes: [] },
      { tag: 'a', position: 6, attributes: [{ name: 'href', value: '#' }] },
      { tag: 'li', position: 7, attributes: [] },
      { tag: 'a', position: 8, attributes: [{ name: 'href', value: '#' }] },
      { tag: 'main', position: 9, attributes: [] },
      { tag: 'article', position: 10, attributes: [] },
      { tag: 'h1', position: 11, attributes: [] },
      { tag: 'p', position: 12, attributes: [] }
    ]);

    // Check that markdown contains expected content
    const markdown = result.markdown;
    if (!markdown.includes('# Title') || 
        !markdown.includes('Content') ||
        !markdown.includes('Link 1') ||
        !markdown.includes('Link 2')) {
      throw new Error('Markdown is missing expected content');
    }

    assertEqual(result.sender, 'test@example.com');
    assertEqual(result.subject, 'Test Subject');
  });

  await test('FeatureExtractor should remove excess whitespace from meta context', async () => {
    const extractor = new FeatureExtractor();
    const features = {
      sender: '   test@example.com    ',
      subject: '\n  Test Email     ',
      markdown: '\n\nThis is  a **test**   email   body\n'
    };
    
    const { context, truncatedContext } = extractor.extractMetaFeatures(features);
    const expected = 'test@example.com Test Email This is a **test** email body';
    
    assertEqual(context, expected);
    assertEqual(truncatedContext, expected);
  });

  // Before GmailPreprocessor tests
  printTestSeparator('GmailPreprocessor');

  await test('GmailPreprocessor initialization', async () => {
    const processor = new GmailPreprocessor();
    if (!processor) throw new Error('Failed to initialize GmailPreprocessor');
  });

  await test('GmailPreprocessor processes email correctly', async () => {
    const processor = new GmailPreprocessor();
    const email = {
      data: {
        id: 'test123',
        threadId: 'thread123',
        labelIds: ['INBOX', 'UNREAD'],
        payload: {
          headers: [
            { name: 'From', value: 'sender@example.com' },
            { name: 'Subject', value: 'Test Email' },
            { name: 'To', value: 'recipient@example.com' }
          ],
          parts: [
            {
              mimeType: 'text/plain',
              body: { data: Base64.encode('This is the plain text content') }
            },
            {
              mimeType: 'text/html',
              body: { data: Base64.encode('<p>This is the HTML content</p>') }
            },
            {
              mimeType: 'application/pdf',
              filename: 'test.pdf',
              body: { attachmentId: 'att123', size: 12345 }
            }
          ]
        }
      }
    };
   
    const result = await processor.process(email);
    if (!result) throw new Error('Email processing failed');
  });

  await test('GmailPreprocessor handles invalid email', async () => {
    const processor = new GmailPreprocessor();
    const invalidEmail = null;
    
    try {
      await processor.process(invalidEmail);
    } catch (error) {
      if (!error.message.includes('Failed to process email')) {
        throw new Error(`Expected 'Failed to process email' error but got: ${error.message}`);
      }
    }
  });

  // Before EMLPreprocessor tests
  printTestSeparator('EMLPreprocessor');

  await test('EMLPreprocessor initialization', async () => {
    const processor = new EMLPreprocessor();
    if (!processor) throw new Error('Failed to initialize EMLPreprocessor');
  });

  await test('EMLPreprocessor processes EML correctly', async () => {
    const processor = new EMLPreprocessor();
    const mockEml = `From: sender@example.com
Subject: Test Subject
Content-Type: multipart/mixed; boundary="boundary123"

--boundary123
Content-Type: text/plain

This is plain text content.

--boundary123
Content-Type: text/html

<p>This is HTML content</p>

--boundary123
Content-Type: application/pdf
Content-Disposition: attachment; filename="test.pdf"
Content-Length: 1234

[PDF content would be here]
--boundary123--`;

    const result = await processor.process(mockEml);
    
    partialEqual(result, {
      threadId: '',
      labelIds: [],
      headers: {
        From: 'sender@example.com',
        Subject: 'Test Subject',
        'Content-Type': 'multipart/mixed; boundary="boundary123"'
      },
      sender: 'sender@example.com',
      subject: 'Test Subject',
      body: {
        plain: 'This is plain text content.\r\n',
        html: '<p>This is HTML content</p>'
      },
      attachments: [{
        id: '',
        filename: 'test.pdf',
        mimeType: 'application/pdf',
        size: 0
      }]
    });
  });

  await test('EMLPreprocessor handles empty EML', async () => {
    const processor = new EMLPreprocessor();
    const emptyEml = '';
    
    const result = await processor.process(emptyEml);
    
    partialEqual(result, {
      labelIds: [],
      headers: {},
      sender: '',
      subject: '',
      body: {
        plain: '',
        html: ''
      },
      attachments: []
    });
  });

  await test('EMLPreprocessor handles EML without attachments', async () => {
    const processor = new EMLPreprocessor();
    const simpleEml = `From: simple@example.com
Subject: Simple Email
Content-Type: text/plain

Just a simple plain text email.`;

    const result = await processor.process(simpleEml);
    
    partialEqual(result, {
      threadId: '',
      labelIds: [],
      headers: {
        From: 'simple@example.com',
        Subject: 'Simple Email',
        'Content-Type': 'text/plain'
      },
      sender: 'simple@example.com',
      subject: 'Simple Email',
      body: {
        plain: 'Just a simple plain text email.',
        html: ''
      },
      attachments: []
    });
  });

  await test('EMLPreprocessor handles real EML', async () => {
    const processor = new EMLPreprocessor();
    const sampleEML = `Delivered-To: rllluo@gmail.com
Received: by 2002:a05:7109:708e:b0:3ef:f6ce:9a33 with SMTP id jx14csp3464938gdc;
        Sat, 21 Dec 2024 22:32:59 -0800 (PST)
X-Google-Smtp-Source: AGHT+IHA2jRk7eI7P9pPhXHRBPXh/jO9yvHic27qXGsFLXfvG+Us+imDjBjBaqe+kvJLH5BB3TeH
X-Received: by 2002:a05:6214:4290:b0:6d4:1a42:8efa with SMTP id 6a1803df08f44-6dd230cbcabmr144726606d6.0.1734849179777;
        Sat, 21 Dec 2024 22:32:59 -0800 (PST)
ARC-Seal: i=1; a=rsa-sha256; t=1734849179; cv=none;
        d=google.com; s=arc-20240605;
        b=XZXcpIkYEweh/22DuLokPlmU5iR/Fz51RRwIU5Z4T4p/BXCl8mVLPePfqojCrOfY6W
         DE3UM0Su8ASsNYobfg80U+HQwAKnfV8IibFTayxb7U5kCp1K5TDVdrvRX5FD/lwFGt2P
         93FxZSP5U8u/MO5C0NnZMtOTtzeJU86rOf/j8k1EfRRYuS3wmHaC5ZnrWeJ0x7rujh0y
         pPHvPExc3j8QB0rLhvcelEZCKASe/TtlUHYBu31TqqoVaAGN8/rsS2o+p87WlVDVn2kB
         UiDx8c2WCVJrg25TLELj+e7ViQ+SqGK9ZI/EeeetbKWfmtycoyiEC6sgabLOzoYu8+ts
         fdDQ==
ARC-Message-Signature: i=1; a=rsa-sha256; c=relaxed/relaxed; d=google.com; s=arc-20240605;
        h=to:subject:message-id:mime-version:from:date:dkim-signature
         :dkim-signature;
        bh=JAZZ+7VoKx8+1k6uH+OvE3Fb25OV9MqJTw14uBnFQOY=;
        fh=GXGNrmPdvIp3FC5JArwtFaT9PXHjI8VSME13QipZX9Y=;
        b=JLYYPpt6RMPUWd9HOiUFqVENJ+XuETQrXtTZFBuP1bPk1aLCHPylhxrDYR3CYLGw9U
         FUSl57keFOIWhXu3TajfQtG8a5ijO/f0gS5tnkw3PCPX1FijcFYRr+9g1Vj0e2Tct/Qg
         J6pNLsaraTAHxFg+pPFYlgpF46cRRbqQh6KsNm1AsjxnJLAQo1+UprXBId5Wj9yWhQ4S
         9NzDVtMF8eqiDpf7fe41H6OKBPB1f8dJgnvK1kmXLf1WTVIhNcqj52226Cm1Za0mPwUN
         dg9aQETGqjrv6mbZRPPXIEH2U2tXeN52nIthdcYlxv/WRQsf6ICngsZCrkG0pzzbSQGd
         Icdg==;
        dara=google.com
ARC-Authentication-Results: i=1; mx.google.com;
       dkim=pass header.i=@email.nextdoor.com header.s=s1 header.b=KYyouB1E;
       dkim=pass header.i=@sendgrid.info header.s=smtpapi header.b="BJzpf/DJ";
       spf=pass (google.com: domain of bounces+1740995-d635-rllluo=gmail.com@rs.email.nextdoor.com designates 167.89.48.102 as permitted sender) smtp.mailfrom="bounces+1740995-d635-rllluo=gmail.com@rs.email.nextdoor.com";
       dmarc=pass (p=REJECT sp=REJECT dis=NONE) header.from=nextdoor.com
Return-Path: <bounces+1740995-d635-rllluo=gmail.com@rs.email.nextdoor.com>
Received: from o8.email.nextdoor.com (o8.email.nextdoor.com. [167.89.48.102])
        by mx.google.com with ESMTPS id 6a1803df08f44-6dd18138ed7si87189006d6.157.2024.12.21.22.32.59
        for <rllluo@gmail.com>
        (version=TLS1_3 cipher=TLS_AES_128_GCM_SHA256 bits=128/128);
        Sat, 21 Dec 2024 22:32:59 -0800 (PST)
Received-SPF: pass (google.com: domain of bounces+1740995-d635-rllluo=gmail.com@rs.email.nextdoor.com designates 167.89.48.102 as permitted sender) client-ip=167.89.48.102;
Authentication-Results: mx.google.com;
       dkim=pass header.i=@email.nextdoor.com header.s=s1 header.b=KYyouB1E;
       dkim=pass header.i=@sendgrid.info header.s=smtpapi header.b="BJzpf/DJ";
       spf=pass (google.com: domain of bounces+1740995-d635-rllluo=gmail.com@rs.email.nextdoor.com designates 167.89.48.102 as permitted sender) smtp.mailfrom="bounces+1740995-d635-rllluo=gmail.com@rs.email.nextdoor.com";
       dmarc=pass (p=REJECT sp=REJECT dis=NONE) header.from=nextdoor.com
DKIM-Signature: v=1; a=rsa-sha256; c=relaxed/relaxed; d=email.nextdoor.com;
	h=content-type:from:mime-version:subject:x-feedback-id:to:cc:
	content-type:from:subject:to;
	s=s1; bh=JAZZ+7VoKx8+1k6uH+OvE3Fb25OV9MqJTw14uBnFQOY=;
	b=KYyouB1ENzycgeY9qkdYRgkwnSJ+dg6Yag65mR0grJcaa4JQ9XXV+fQw0JtP7qUYC48G
	EXJlbZ0zoUdRY6l9s251TU5DfgGRV5iM8KAcB+CnNLsH1BhwCjIlESMZqta0HbV68hgBGn
	cHoKfCwKwn/RP10Eo5lCbrAiEQUUnoJ+OzQEU7JM8jaUZ20OlIQ0vuc7BRujgDWs+lGDCf
	ASEyacQ/E06LnbiDHZUegZ1AaJlWbkj+Ghmy4hFnh7G/URnp587Cbv097TOrLMv2+cIpzn
	f0DwEnhLztxStfjbCYCA4diYxdwKGws0P3w2LVupF4drHLBTZm793EBOxcvkdnEA==
DKIM-Signature: v=1; a=rsa-sha256; c=relaxed/relaxed; d=sendgrid.info;
	h=content-type:from:mime-version:subject:x-feedback-id:to:cc:
	content-type:from:subject:to;
	s=smtpapi; bh=JAZZ+7VoKx8+1k6uH+OvE3Fb25OV9MqJTw14uBnFQOY=;
	b=BJzpf/DJMsINA9Lm6jYI/uQwW1FdyEAbGoOYNRtQbeajxq2Z0e8NogQGF3KPjrayaaud
	0FWsXhEZY3vy/W37PWGnCeq/rxk2bdcSLifxZYnhg9yys+L+C3cRLWQW/kXDiK2W1NM7iW
	kJTvYCkJ1Aif7EuyJbAiNLHWgU2GJp1vQ=
Received: by recvd-766dd68955-pmmp5 with SMTP id recvd-766dd68955-pmmp5-1-6767B29A-9
	2024-12-22 06:32:58.467366085 +0000 UTC m=+3229839.953321803
Received: from MTc0MDk5NQ (unknown)
	by geopod-ismtpd-1 (SG) with HTTP
	id FdCZyEvOTU-CRTqi9HFNLA
	Sun, 22 Dec 2024 06:32:58.396 +0000 (UTC)
Content-Type: multipart/alternative; boundary=b5cf65e5611a49b956343ad77aeeb689c2e3a83ffffc5f072898b0b0fbed
Date: Sun, 22 Dec 2024 06:32:58 +0000 (UTC)
From: Nextdoor <no-reply@is.email.nextdoor.com>
Mime-Version: 1.0
Message-ID: <FdCZyEvOTU-CRTqi9HFNLA@geopod-ismtpd-1>
Subject: New from Kim and other neighbors in San Francisco
X-Auto-Response-Suppress: All
X-Feedback-ID: 1740995:SG
X-SG-EID: 
 =?us-ascii?Q?u001=2EMtD++O2bOrxpk3poYlyqNMJIhXIQJZSBY6vOQ9IpbNM57kpzQgk00LEpq?=
 =?us-ascii?Q?q0WYzCLT1wCA9j8IJcmEKVzypmlmdGaslsPsX3t?=
 =?us-ascii?Q?tbNTdGbLoLfCQp6Yt=2FWTYk6FQL4fZsFVfixz1Ff?=
 =?us-ascii?Q?uwxTw72oFwA+kInZjM5D5MQLfSzsVxR9sf5P5LX?=
 =?us-ascii?Q?IQA0r3MC7Cy=2FGDsP=2F9Gdm8Ji0pewfdfvX5KXahL?=
 =?us-ascii?Q?VoyRoVD6Ar79iJ43Fgmf+47C=2F=2F5PE8aJWnZ4mha?=
 =?us-ascii?Q?RgPJ?=
X-SG-ID: 
 =?us-ascii?Q?u001=2ESdBcvi+Evd=2FbQef8eZF3BpinGYdlB1Bf8L8M4y4=2FRJu4EZ+tCjQWLAxn9?=
 =?us-ascii?Q?E1yp8STw80paG8Prr1irc9h+rE+dfFOu34Ha6v8?=
 =?us-ascii?Q?PDgToJ7OqTqY2RO1ofjN2y26FUx2ZOTdzJvoJiG?=
 =?us-ascii?Q?1q9RekGh5xeWfie2YjQnSg6soF9TIeM9wZPzylE?=
 =?us-ascii?Q?7ZQQrMafJrzfPsRU5vjPRduy23qeaBZbvP1z4gq?=
 =?us-ascii?Q?ggKYZZlC9MmKppb5QZuWDZMVqGpliwmPx9L8j1n?=
 =?us-ascii?Q?GtNUyr=2FgGNLgNqo2mXoOo4L11ZF36qOxs88XZwu?=
 =?us-ascii?Q?=2FY9tkTb8p9J3CPNFsPddbN5myLbz8OIFbWRlzXp?=
 =?us-ascii?Q?wCYEStgRaJuUBm+6xTSQ0UMNnksvFiu79+itEXT?=
 =?us-ascii?Q?efjctBJCYQ8pEQzCXGHUvGS768VyxMhgxQMRoPi?=
 =?us-ascii?Q?TWk66aBK2hff7HAFM=2FLQrg9C2usjhzSnN0P5h7c?=
 =?us-ascii?Q?=2F0Jl2aj10fSr7Nyu6R=2FBb82ECYqoCkOnUbq+hvd?=
 =?us-ascii?Q?DYsPOJ70LGFkc87KNx675khk+RWch=2FtqWNvBVIz?=
 =?us-ascii?Q?mJ55cE6ng=3D=3D?=
To: rllluo@gmail.com
X-Entity-ID: u001./MbbEg8sPL55pjOzXlgn/g==

--b5cf65e5611a49b956343ad77aeeb689c2e3a83ffffc5f072898b0b0fbed
Content-Transfer-Encoding: quoted-printable
Content-Type: text/plain; charset=us-ascii
Mime-Version: 1.0

You've got 20+ recent notifications

See what you missed:
https://nextdoor.com/notifications/?s=3Dmne&ct=3Dusy4jJIjygQPvw9mFrYP48JTd8=
_BiCd1P9pDhysIizpn5xOp4NuukL7Sl8ebL__L&ec=3D193ObVDDLDH7-4JHPwK6rzPTO8__RwJ=
EBS9cuDRAWHc=3D&token=3Df-KxVrhXpZKbm6jezN2DR0K4Yte6mlXnHQlbQclKECNolM-Od6E=
Wksdv8S2RrVQF_pN9IPeChSDVBir00jm2w93Iyp81rt5x59zrR44ecjo%3D&auto_token=3Di3=
FV0rSYvCxjSquTs3yGgZYkQfzhO1uKaEJHfWKxfnbyP1WX8db6G0x2AkL1-ba7n_3b8C1FoxICC=
UYWl1PkhzzMx-eQOEB1BP7n8-SdSsg%3D&mobile_deeplink_data=3DeyJhY3Rpb24iOiAibm=
90aWZpY2F0aW9ucyJ9&link_source_user_id=3D55470070

---------------------------
To unsubscribe, please visit:
https://nextdoor.com/category_unsub/?p=3D55470070&c=3D&e=3D344&k=3D4f56278a=
4a0031b&prefs=3Dmissed_notifications

This message was intended for rllluo@gmail.com.
Nextdoor, 420 Taylor Street, San Francisco, CA 94102
--b5cf65e5611a49b956343ad77aeeb689c2e3a83ffffc5f072898b0b0fbed
Content-Transfer-Encoding: quoted-printable
Content-Type: text/html; charset=us-ascii
Mime-Version: 1.0


<!DOCTYPE html><html><head><title>Nextdoor</title><meta http-equiv=3D"Conte=
nt-Type" content=3D"text/html; charset=3Dutf-8"/><meta name=3D"viewport" co=
ntent=3D"width=3Ddevice-width, initial-scale=3D1"/><meta http-equiv=3D"X-UA=
-Compatible" content=3D"IE=3Dedge"/><meta name=3D"viewport" content=3D"widt=
h=3Ddevice-width, initial-scale=3D1"/><meta name=3D"x-apple-disable-message=
-reformatting"/><link href=3D"https://fonts.googleapis.com/css2?family=3DLa=
to:ital,wght@1,900&amp;display=3Dswap" rel=3D"stylesheet"/><style>
body,
table,
td,
a {
  -webkit-text-size-adjust: 100%;
  -ms-text-size-adjust: 100%;
}

table,
td {
  mso-table-lspace: 0pt;
  mso-table-rspace: 0pt;
}

img {
  -ms-interpolation-mode: bicubic;
}
</style><style>
img {
  border: 0;
  height: auto;
  line-height: 100%;
  outline: none;
  text-decoration: none;
}

table {
  border-collapse: collapse;
}

body {
  height: 100% !important;
  margin: 0 !important;
  padding: 0 !important;
  width: 100% !important;
}

h1, h2, h3, h4, h5, h6, p {
  margin: 0;
}
</style><style>
a[x-apple-data-detectors] {
  color: inherit !important;
  text-decoration: none !important;
  font-size: inherit !important;
  font-family: inherit !important;
  font-weight: inherit !important;
  line-height: inherit !important;
}
</style><style>
u+#body a {
  color: inherit;
  text-decoration: none;
  font-size: inherit;
  font-family: inherit;
  font-weight: inherit;
  line-height: inherit;
}
</style><style>
#MessageViewBody a {
  color: inherit;
  text-decoration: none;
  font-size: inherit;
  font-family: inherit;
  font-weight: inherit;
  line-height: inherit;
}
</style><style>
a {
  color: #0076B6;
  text-decoration: none;
}

a:hover {
  color: #0085CC;
  text-decoration: none;
}

a.button:hover {
  background-color: #0085CC !important;
}
</style><style>
@media screen and (max-width: 600px) {
  h1 {
    font-size: 24px !important;
  }

  .if-mobile-full-width {
    max-width: 100% !important;
    width: 100% !important;
  }

  .if-mobile-remove-padding {
    padding: 0 !important;
  }

  .HIDE_EXCEPT_ON_DESKTOP_CLASS {
    display: none !important;
  }
}
</style><style>
@media only screen and (min-width: 600px) {
  table[class=3D"ios-wrapper"] {
    width: 600px;
  }
}

@media only screen and (max-width: 600px) {
  table[class=3D"ios-wrapper"] {
    width: 95%;
  }
}

@media all and (max-width: 480px) {
  table[class=3D"ios-wrapper"] {
    /*border-top: 0 !important;
      border-left: 0 !important;
      border-right: 0 !important;
      border-radius: 0 !important;*/
  }

  td[class=3D"inner-background"] {
    padding-top: 6px !important;
  }
}
</style><style>
  .no-background-layout-content-box {
    background-color: #FFFFFF;
  }
  .no-background-layout-content-box-padding {
    padding: 24px 0px;
  }
  @media screen and (min-width: 600px) {
    .no-background-layout-content-box {
      border: 1px solid #CCCCCC;
      border-radius: 8px;
      border-collapse: separate;
    }
    .no-background-layout-content-box-padding {
      padding: 32px 24px;
    }
  }
</style><style>
  .dark-mode-only {
    display: none !important;
  }
  [data-ogsc] .light-mode-only, [data-ogsb] .light-mode-only {
    display: none !important;
  }
  [data-ogsc] .dark-mode-only, [data-ogsb] .dark-mode-only {
    display: block !important;
  }
  u+#body .gmail-dark-mode-difference {
    mix-blend-mode: difference;
  }
  u+#body .gmail-dark-mode-difference .light-mode-only {
    display: none !important;
  }
  u+#body .gmail-dark-mode-difference .dark-mode-only {
    display: block !important;
  }
</style></head><body id=3D"body"><table width=3D"100%" align=3D"left" style=
=3D"overflow:hidden;max-width:100%;min-width:100%" border=3D"0" cellPadding=
=3D"0" cellSpacing=3D"0" role=3D"presentation"><tbody><tr><td style=3D"disp=
lay:none;font-size:1px;color:rgba(255, 255, 255, 0.05);line-height:1px;max-=
height:0px;max-width:0px;opacity:0;overflow:hidden"><a rel=3D"nofollow" sty=
le=3D"display:none;font-size:1px;color:rgba(255, 255, 255, 0.05);line-heigh=
t:1px;max-height:0px;max-width:0px;opacity:0;overflow:hidden">Ryan, see you=
r unread notifications&#847; &#847; &#847; &#847; &#847; &#847; &#847; &#84=
7; &#847; &#847; &#847; &#847; &#847; &#847; &#847; &#847; &#847; &#847; &#=
847; &#847; &#847; &#847; &#847; &#847; &#847; &#847; &#847; &#847; &#847; =
&#847; &#847; &#847; &#847; &#847; &#847; &#847; &#847; &#847; &#847; &#847=
; &#847; &#847; &#847; &#847; &#847; &#847; &#847; &#847; &#847; &#847; &#8=
47; &#847; &#847; &#847; &#847; &#847; &#847; &#847; &#847; &#847; &#847; &=
#847; &#847; &#847; &#847; &#847; &#847; &#847; &#847; &#847; &#847; &#847;=
 &#847; &#847; &#847; &#847; &#847; &#847; &#847; &#847; &#847; &#847; &#84=
7; &#847; &#847; &#847; &#847; &#847; &#847; &#847; &#847; &#847; &#847; &#=
847; &#847; &#847; &#847; &#847; &#847; &#847; &#847; &#847; &#847; &#847; =
&#847; &#847; &#847; &#847; &#847; &#847; &#847; &#847; &#847; &#847; &#847=
; &#847; &#847; &#847; &#847; &#847; &#847; &#847; &#847; &#847; &#847; &#8=
47; &#847; &#847; &#847; &#847; &#847; &#847; &#847; &#847; &#847; &#847; &=
#847; &#847; &#847; &#847; &#847; &#847; &#847; &#847; &#847; &#847; &#847;=
 &#847; &#847; &#847; &#847; &#847; &#847; &#847; &#847; &#847; &#847; &#84=
7; &#847; &#847; &#847; &#847; &#847; &#847; &#847; &#847; &#847; &#847; &#=
847; &#847; &#847; &#847; &#847; &#847; &#847; &#847; &#847; &#847; &#847; =
&#847; &#847; &#847; &#847; &#847; &#847; &#847; &#847; &#847; &#847; &#847=
; &#847; &#847; &#847; &#847; &#847; &#847; &#847; &#847; &#847; &#847; &#8=
47; &#847; &#847; &#847; &#847; &#847; &#847; &#847; &#847; &#847; &#847; &=
#847; &#847; &#847; &#847; &#847; &#847; &#847; &#847; &#847; &#847; &#847;=
 &#847; &#847; &#847; &#847; &#847; &#847; &#847; &#847; &#847; &#847; &#84=
7; &#847; &#847; &#847; &#847; &#847; &#847; &#847; &#847; &#847; &#847; &#=
847; &#847; &#847; &#847; &#847; &#847; &#847; &#847; &#847; &#847; &#847; =
&#847; &#847; &#847; &#847; &#847; &#847; &#847; &#847; &#847; &#847; &#847=
; &#847; &#847; &#847; &#847; &#847; &#847; &#847; &#847; &#847; &#847; &#8=
47; &#847; &#847; &#847; &#847; &#847; &#847; &#847; &#847; &#847; &#847; &=
#847; &#847; &#847; &#847; &#847; &#847; &#847; &#847; &#847; &#847; &#847;=
 &#847; &#847; &#847; &#847; &#847; &#847; &#847; &#847; &#847; &#847; &#84=
7; &#847; &#847; &#847; &#847; &#847; &#847; &#847; &#847; &#847; &#847; &#=
847; &#847; &#847; &#847; &#847; &#847; &#847; &#847; &#847; &#847; &#847; =
&#847; &#847; &#847; &#847; &#847; &#847; &#847; &#847; &#847; &#847; &#847=
; &#847; &#847; &#847; &#847; &#847; &#847; &#847; &#847; &#847; &#847; &#8=
47; &#847; &#847; &#847; &#847; &#847; &#847; &#847; &#847; &#847; &#847; &=
#847; &#847; &#847; &#847; &#847; &#847; &#847; &#847; &#847; &#847; &#847;=
 &#847; &#847; &#847; &#847; &#847; &#847; &#847; &#847; &#847; &#847; &#84=
7; &#847; &#847; &#847; &#847; &#847; &#847; &#847; &#847; &#847; &#847; &#=
847; &#847; &#847; &#847; &#847; &#847; &#847; </a></td></tr></tbody></tabl=
e><table width=3D"100%" align=3D"left" style=3D"overflow:hidden;max-width:1=
00%;min-width:100%;background-color:#FFFFFF" border=3D"0" cellPadding=3D"0"=
 cellSpacing=3D"0" role=3D"presentation"><tbody><tr><td><table width=3D"600=
" align=3D"center" style=3D"overflow:hidden;max-width:100%" border=3D"0" ce=
llPadding=3D"0" cellSpacing=3D"0" role=3D"presentation" class=3D"ios-wrappe=
r"><tbody><tr><td><table width=3D"100%" align=3D"center" style=3D"overflow:=
hidden;max-width:100%;min-width:100%" border=3D"0" cellPadding=3D"0" cellSp=
acing=3D"0" role=3D"presentation"><tbody><tr><td style=3D"padding:12px 0"><=
table width=3D"100%" align=3D"center" style=3D"overflow:hidden;max-width:10=
0%;min-width:100%;padding:20px 0" border=3D"0" cellPadding=3D"0" cellSpacin=
g=3D"0" role=3D"presentation"><tbody><tr><td align=3D"left" style=3D"vertic=
al-align:middle;text-align:left;padding-right:0"><a href=3D"https://nextdoo=
r.com/news_feed/?ct=3Dusy4jJIjygQPvw9mFrYP48JTd8_BiCd1P9pDhysIizpn5xOp4Nuuk=
L7Sl8ebL__L&amp;ec=3D193ObVDDLDH7-4JHPwK6rzPTO8__RwJEBS9cuDRAWHc=3D&amp;tok=
en=3Df-KxVrhXpZKbm6jezN2DR0K4Yte6mlXnHQlbQclKECNolM-Od6EWksdv8S2RrVQF_pN9IP=
eChSDVBir00jm2w93Iyp81rt5x59zrR44ecjo%3D&amp;auto_token=3Di3FV0rSYvCxjSquTs=
3yGgZYkQfzhO1uKaEJHfWKxfnbyP1WX8db6G0x2AkL1-ba7n_3b8C1FoxICCUYWl1PkhzzMx-eQ=
OEB1BP7n8-SdSsg%3D"><img src=3D"https://d19rpgkrjeba2z.cloudfront.net/f93ad=
278982d0f3f/static/images/nextdoor_logo_2020.png" alt=3D"Nextdoor logo" wid=
th=3D"126" style=3D"width:126px"/></a></td><td align=3D"right" style=3D"ver=
tical-align:middle;text-align:right;padding-left:0"><a href=3D"https://next=
door.com/profile/01mTDYdNBBb8zf8QH/?ct=3Dusy4jJIjygQPvw9mFrYP48JTd8_BiCd1P9=
pDhysIizpn5xOp4NuukL7Sl8ebL__L&amp;ec=3D193ObVDDLDH7-4JHPwK6rzPTO8__RwJEBS9=
cuDRAWHc=3D&amp;token=3Df-KxVrhXpZKbm6jezN2DR0K4Yte6mlXnHQlbQclKECNolM-Od6E=
Wksdv8S2RrVQF_pN9IPeChSDVBir00jm2w93Iyp81rt5x59zrR44ecjo%3D&amp;auto_token=
=3Di3FV0rSYvCxjSquTs3yGgZYkQfzhO1uKaEJHfWKxfnbyP1WX8db6G0x2AkL1-ba7n_3b8C1F=
oxICCUYWl1PkhzzMx-eQOEB1BP7n8-SdSsg%3D"><img src=3D"https://d19rpgkrjeba2z.=
cloudfront.net/f93ad278982d0f3f/static/nextdoorv2/images/avatars/avatar-r.p=
ng" alt=3D"Your profile photo" width=3D"32" style=3D"width:32px;border-radi=
us:50%"/></a></td></tr></tbody></table></td></tr></tbody></table></td></tr>=
<tr><td><table width=3D"100%" align=3D"left" style=3D"overflow:hidden;max-w=
idth:100%;min-width:100%" border=3D"0" cellPadding=3D"0" cellSpacing=3D"0" =
role=3D"presentation"><tbody><tr><td><table width=3D"100%" align=3D"left" s=
tyle=3D"overflow:hidden;max-width:100%;min-width:100%" border=3D"0" cellPad=
ding=3D"0" cellSpacing=3D"0" role=3D"presentation"><tbody><tr><td><table wi=
dth=3D"100%" align=3D"center" style=3D"overflow:hidden;max-width:100%;min-w=
idth:100%" border=3D"0" cellPadding=3D"0" cellSpacing=3D"0" role=3D"present=
ation"><tbody><tr><td style=3D"text-align:center"><h2><span style=3D"color:=
#000000;font-family:system-ui,-apple-system,BlinkMacSystemFont,&#x27;Helvet=
icaNeue&#x27;,&#x27;Helvetica Neue&#x27;,Helvetica,&#x27;Roboto&#x27;,&#x27=
;Segoe UI&#x27;,Arial,sans-serif;font-size:28px;line-height:32px;font-weigh=
t:700">You&#x27;ve got 20+ recent notifications</span></h2></td></tr></tbod=
y></table><table class=3D"spacer"><tbody><tr><td style=3D"height:20px;min-h=
eight:20px;width:100%"></td></tr></tbody></table><div class=3D"custom-list"=
></div><table class=3D"spacer"><tbody><tr><td style=3D"height:16px;min-heig=
ht:16px;width:100%"></td></tr></tbody></table><table width=3D"100%" align=
=3D"center" style=3D"overflow:hidden;max-width:100%;min-width:100%" border=
=3D"0" cellPadding=3D"0" cellSpacing=3D"0" role=3D"presentation"><tbody><tr=
><td style=3D"text-align:center"><!--[if mso]>
          <v:roundrect xmlns:v=3D"urn:schemas-microsoft-com:vml" xmlns:w=3D=
"urn:schemas-microsoft-com:office:word" href=3D"https://nextdoor.com/notifi=
cations/?s=3Dmne&ct=3Dusy4jJIjygQPvw9mFrYP48JTd8_BiCd1P9pDhysIizpn5xOp4Nuuk=
L7Sl8ebL__L&ec=3D193ObVDDLDH7-4JHPwK6rzPTO8__RwJEBS9cuDRAWHc=3D&token=3Df-K=
xVrhXpZKbm6jezN2DR0K4Yte6mlXnHQlbQclKECNolM-Od6EWksdv8S2RrVQF_pN9IPeChSDVBi=
r00jm2w93Iyp81rt5x59zrR44ecjo%3D&auto_token=3Di3FV0rSYvCxjSquTs3yGgZYkQfzhO=
1uKaEJHfWKxfnbyP1WX8db6G0x2AkL1-ba7n_3b8C1FoxICCUYWl1PkhzzMx-eQOEB1BP7n8-Sd=
Ssg%3D&mobile_deeplink_data=3DeyJhY3Rpb24iOiAibm90aWZpY2F0aW9ucyJ9&link_sou=
rce_user_id=3D55470070" style=3D"height:40px;v-text-anchor:middle;width:200=
px;" arcsize=3D"30%" stroke=3D"f" fillcolor=3D"#B8EC51">
            <w:anchorlock/>
            <center>
        <![endif]--><a href=3D"https://nextdoor.com/notifications/?s=3Dmne&=
amp;ct=3Dusy4jJIjygQPvw9mFrYP48JTd8_BiCd1P9pDhysIizpn5xOp4NuukL7Sl8ebL__L&a=
mp;ec=3D193ObVDDLDH7-4JHPwK6rzPTO8__RwJEBS9cuDRAWHc=3D&amp;token=3Df-KxVrhX=
pZKbm6jezN2DR0K4Yte6mlXnHQlbQclKECNolM-Od6EWksdv8S2RrVQF_pN9IPeChSDVBir00jm=
2w93Iyp81rt5x59zrR44ecjo%3D&amp;auto_token=3Di3FV0rSYvCxjSquTs3yGgZYkQfzhO1=
uKaEJHfWKxfnbyP1WX8db6G0x2AkL1-ba7n_3b8C1FoxICCUYWl1PkhzzMx-eQOEB1BP7n8-SdS=
sg%3D&amp;mobile_deeplink_data=3DeyJhY3Rpb24iOiAibm90aWZpY2F0aW9ucyJ9&amp;l=
ink_source_user_id=3D55470070" style=3D"border-radius:12px;background-color=
:#B8EC51;color:#006142;text-decoration:none;font-family:system-ui,-apple-sy=
stem,BlinkMacSystemFont,&#x27;HelveticaNeue&#x27;,&#x27;Helvetica Neue&#x27=
;,Helvetica,&#x27;Roboto&#x27;,&#x27;Segoe UI&#x27;,Arial,sans-serif;paddin=
g:12px;text-align:center;font-weight:600;font-size:16px;min-width:initial;d=
isplay:block">See what you missed</a><!--[if mso]>
            </center>
          </v:roundrect>
        <![endif]--></td></tr></tbody></table></td></tr></tbody></table></t=
d></tr></tbody></table></td></tr><tr><td><table width=3D"100%" align=3D"lef=
t" style=3D"overflow:hidden;max-width:100%;min-width:100%" border=3D"0" cel=
lPadding=3D"0" cellSpacing=3D"0" role=3D"presentation"><tbody><tr><td style=
=3D"padding:12px 0"><a href=3D"#" style=3D"text-decoration:none;cursor:defa=
ult"><p><span style=3D"color:#757575;font-family:system-ui,-apple-system,Bl=
inkMacSystemFont,&#x27;HelveticaNeue&#x27;,&#x27;Helvetica Neue&#x27;,Helve=
tica,&#x27;Roboto&#x27;,&#x27;Segoe UI&#x27;,Arial,sans-serif;font-size:13p=
x;line-height:16px;font-weight:400">This message was intended for rllluo@gm=
ail.com</span></p></a><p><a href=3D"https://nextdoor.com/category_unsub/?p=
=3D55470070&amp;c=3D&amp;e=3D344&amp;k=3D4f56278a4a0031b&amp;prefs=3Dmissed=
_notifications&amp;ct=3Dusy4jJIjygQPvw9mFrYP48JTd8_BiCd1P9pDhysIizpn5xOp4Nu=
ukL7Sl8ebL__L&amp;ec=3D193ObVDDLDH7-4JHPwK6rzPTO8__RwJEBS9cuDRAWHc=3D&amp;t=
oken=3Df-KxVrhXpZKbm6jezN2DR0K4Yte6mlXnHQlbQclKECNolM-Od6EWksdv8S2RrVQF_pN9=
IPeChSDVBir00jm2w93Iyp81rt5x59zrR44ecjo%3D&amp;auto_token=3Di3FV0rSYvCxjSqu=
Ts3yGgZYkQfzhO1uKaEJHfWKxfnbyP1WX8db6G0x2AkL1-ba7n_3b8C1FoxICCUYWl1PkhzzMx-=
eQOEB1BP7n8-SdSsg%3D" style=3D"color:#0076B6;font-family:system-ui,-apple-s=
ystem,BlinkMacSystemFont,&#x27;HelveticaNeue&#x27;,&#x27;Helvetica Neue&#x2=
7;,Helvetica,&#x27;Roboto&#x27;,&#x27;Segoe UI&#x27;,Arial,sans-serif;font-=
size:13px;line-height:16px;font-weight:400">Unsubscribe or adjust your emai=
l settings</a></p><table class=3D"spacer"><tbody><tr><td style=3D"height:12=
px;min-height:12px;width:100%"></td></tr></tbody></table><p><span style=3D"=
color:#757575;font-family:system-ui,-apple-system,BlinkMacSystemFont,&#x27;=
HelveticaNeue&#x27;,&#x27;Helvetica Neue&#x27;,Helvetica,&#x27;Roboto&#x27;=
,&#x27;Segoe UI&#x27;,Arial,sans-serif;font-size:13px;line-height:16px;font=
-weight:400">420 Taylor Street, San Francisco, CA 94102</span></p></td></tr=
></tbody></table><img src=3D"https://flask.us.nextdoor.com/t_i/spacer.gif?o=
t=3Dusy4jJIjygQPvw9mFrYP48JTd8_BiCd1P9pDhysIizpn5xOp4NuukL7Sl8ebL__L&amp;ec=
=3D193ObVDDLDH7-4JHPwK6rzPTO8__RwJEBS9cuDRAWHc=3D&amp;open_profile_id=3D554=
70070" alt=3D"" width=3D"1" style=3D"width:1px"/></td></tr></tbody></table>=
</td></tr></tbody></table><img src=3D"https://u1740995.ct.sendgrid.net/wf/o=
pen?upn=3Du001.G9a57HDgE21SHa1po5pqVY4xYWMkgUYbRjT0GI2BU31QRn3u3ZCGRsudWMD0=
PPXJhvbny2r5rISV21NGaKsCXJ57gOvtlyTobJ0vfgkFr5oXQ2JR-2FQJ-2B204E41eL2dElPa-=
2FuksQC3wUs6YvtwVQRFiqiqhuGliMVRYyEUS-2FN9MGa9wSjt-2Bv5IQXjJX4G0SkkRpNlNrFN=
kLjlZDWeIXhc6OVtkMJIfIbNPVa-2FiGRQ-2Fwky-2B65icxJtH1R-2Bnvh1PPUX9i4SB-2BCd1=
muAejuRkdNiOpwdOxY-2FxA7-2F3O-2BJA2GS9Q85-2F8wKq0-2BsBJQ-2F8kQG-2BYyiMouxp3=
E-2BFcxH17L7s2KL-2B1jbze9mqmiBl0Z-2FXL0S8v1rWGA8QVqPykkVUvxNuqkrfih5J-2FbPU=
HoRWISZqB0OGd-2BhPoR0KIHp5Q68RPhMzZ2nrCZgoWIzfzIS95zJVBnuBtD7SGGVpzAbIGXHMX=
V0czJJR6tWGYUn4cyKQrNGd2DY6KLO2KOccqtsYRlc-2Fgxwy3Wu7f015LIlQI9qJ9R3BZkIQd1=
X4UmtYzFa15l6wIkiktbQSYbRwuYxV-2FNcQp3F3aeU-2F56aTb9mZ4sSf6upeUIwH4WLl1g0H6=
Q-2Bpmp5ezRDV6kC9EYtvMbjzYWE-2FMYRRoN08iLjAp9YOt80JU2kN22JveNwXEbvzhIh1oL36=
pqpucx4V3zkONlqSYxRGGIee4aV7J6iaGp2LXWlWV-2Fxvw-3D-3D" alt=3D"" width=3D"1"=
 height=3D"1" border=3D"0" style=3D"height:1px !important;width:1px !import=
ant;border-width:0 !important;margin-top:0 !important;margin-bottom:0 !impo=
rtant;margin-right:0 !important;margin-left:0 !important;padding-top:0 !imp=
ortant;padding-bottom:0 !important;padding-right:0 !important;padding-left:=
0 !important;"/></body></html>
--b5cf65e5611a49b956343ad77aeeb689c2e3a83ffffc5f072898b0b0fbed--`
    const result = await processor.process(sampleEML);
    partialEqual(result.headers, {
      'Content-Type': 'multipart/alternative; boundary=b5cf65e5611a49b956343ad77aeeb689c2e3a83ffffc5f072898b0b0fbed',
      Subject: 'New from Kim and other neighbors in San Francisco',
      From: 'Nextdoor <no-reply@is.email.nextdoor.com>'
    });
    partialEqual(result, {
      sender: 'no-reply@is.email.nextdoor.com',
      subject: 'New from Kim and other neighbors in San Francisco',
      attachments: []
    });
  });

  // Print test summary
  console.log(`\nTest Summary: ${passedTests}/${totalTests} tests passed`);
};

// Run the tests
runTests().catch(console.error);
