/**
 * Simple test to verify Pinecone connection
 */

import { Pinecone } from '@pinecone-database/pinecone';
import { env } from '@/config/env';

async function simpleTest() {
  console.log('🔌 Testing Pinecone connection...\n');

  try {
    const pc = new Pinecone({ apiKey: env.PINECONE_API_KEY });
    const index = pc.index(env.PINECONE_INDEX_NAME);

    // Get index stats
    const stats = await index.describeIndexStats();
    console.log('✅ Connected to Pinecone!');
    console.log(`Index: ${env.PINECONE_INDEX_NAME}`);
    console.log(`Total vectors: ${stats.totalRecordCount || 0}`);
    console.log(`Namespaces: ${stats.namespaces ? Object.keys(stats.namespaces).length : 0}`);
    console.log('');

    // Test upsert with a simple vector
    console.log('📝 Testing upsert...');
    const testData = [
      {
        id: 'test-1',
        values: Array(1024).fill(0).map(() => Math.random()),
        metadata: {
          content: 'This is a test memory',
          user_id: 'test_user',
          memory_type: 'test',
        },
      },
    ];

    await index.namespace('test').upsert(testData);
    console.log('✅ Upsert successful!');

    // Wait a moment
    await new Promise((resolve) => setTimeout(resolve, 2000));

    // Test query
    console.log('\n🔍 Testing query...');
    const queryResult = await index.namespace('test').query({
      topK: 1,
      vector: Array(1024).fill(0).map(() => Math.random()),
      includeMetadata: true,
    });

    console.log(`✅ Query successful! Found ${queryResult.matches?.length || 0} results`);
    if (queryResult.matches && queryResult.matches.length > 0) {
      console.log(`First result: ${JSON.stringify(queryResult.matches[0].metadata, null, 2)}`);
    }

    // Clean up
    console.log('\n🧹 Cleaning up test data...');
    await index.namespace('test').deleteAll();
    console.log('✅ Cleanup complete!');

    console.log('\n🎉 All basic tests passed!');
  } catch (error) {
    console.error('❌ Error:', error);
    throw error;
  }
}

simpleTest()
  .then(() => process.exit(0))
  .catch(() => process.exit(1));
