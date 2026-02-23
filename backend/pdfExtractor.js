/**
 * PDF Content Extractor using Playwright + Claude Vision
 *
 * When the extension can't extract content from a PDF (Chrome's PDF viewer blocks it),
 * this module:
 * 1. Uses Playwright to open the PDF and screenshot it
 * 2. Sends the screenshot to Claude's vision API
 * 3. Returns the extracted text
 */

const { chromium } = require('playwright');
const Anthropic = require('@anthropic-ai/sdk');

// Initialize Anthropic client
const anthropic = new Anthropic();

/**
 * Extract text from a PDF URL using Playwright screenshot + Claude Vision
 *
 * @param {string} url - The PDF URL to extract from
 * @param {number} maxPages - Maximum pages to screenshot (default: 3)
 * @returns {Promise<{success: boolean, text?: string, error?: string, pageCount?: number}>}
 */
async function extractPdfContent(url, maxPages = 3) {
  let browser = null;

  try {
    console.log(`[PDF Extractor] Opening PDF: ${url}`);

    // Launch browser
    browser = await chromium.launch({ headless: true });
    const context = await browser.newContext({
      viewport: { width: 1200, height: 1600 }  // Tall viewport for PDFs
    });
    const page = await context.newPage();

    // Navigate to PDF
    await page.goto(url, {
      waitUntil: 'networkidle',
      timeout: 30000
    });

    // Wait for PDF to render (Chrome's PDF viewer takes a moment)
    await page.waitForTimeout(2000);

    // Take screenshot
    const screenshot = await page.screenshot({
      fullPage: false,  // Just the viewport for now
      type: 'png'
    });

    await browser.close();
    browser = null;

    console.log(`[PDF Extractor] Screenshot captured, sending to Claude Vision...`);

    // Send to Claude Vision API
    const base64Image = screenshot.toString('base64');

    const message = await anthropic.messages.create({
      model: 'claude-3-5-haiku-20241022',  // Fast and cheap for OCR
      max_tokens: 4000,
      messages: [
        {
          role: 'user',
          content: [
            {
              type: 'image',
              source: {
                type: 'base64',
                media_type: 'image/png',
                data: base64Image
              }
            },
            {
              type: 'text',
              text: 'Extract ALL text content from this PDF page. Include headers, body text, footnotes, and any other visible text. Preserve the structure (paragraphs, lists, etc.) as much as possible. Return ONLY the extracted text, no commentary.'
            }
          ]
        }
      ]
    });

    const extractedText = message.content[0]?.text || '';

    console.log(`[PDF Extractor] Extracted ${extractedText.length} characters from PDF`);

    return {
      success: true,
      text: extractedText,
      pageCount: 1,
      usage: message.usage
    };

  } catch (error) {
    console.error(`[PDF Extractor] Error: ${error.message}`);

    if (browser) {
      await browser.close();
    }

    return {
      success: false,
      error: error.message
    };
  }
}

/**
 * Process tabs that need visual extraction (PDFs, etc.)
 *
 * @param {Array} tabs - Array of tab objects
 * @returns {Promise<Array>} - Tabs with content filled in where possible
 */
async function processVisualExtractionTabs(tabs) {
  const processedTabs = [];

  for (const tab of tabs) {
    if (tab.needsVisualExtraction && tab.url) {
      console.log(`[PDF Extractor] Processing: ${tab.title || tab.url}`);

      const result = await extractPdfContent(tab.url);

      if (result.success && result.text) {
        processedTabs.push({
          ...tab,
          content: result.text,
          extractionMethod: 'playwright-vision',
          needsVisualExtraction: false  // Clear the flag
        });
      } else {
        // Keep original tab but note the failure
        processedTabs.push({
          ...tab,
          extractionError: result.error,
          extractionMethod: 'failed'
        });
      }
    } else {
      processedTabs.push(tab);
    }
  }

  return processedTabs;
}

module.exports = { extractPdfContent, processVisualExtractionTabs };
