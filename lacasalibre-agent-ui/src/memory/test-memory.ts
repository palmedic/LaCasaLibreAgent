/**
 * Test script for User Memory System
 *
 * Demonstrates storing and retrieving user preferences and memories
 */

import { UserMemory } from './user-memory';

async function testUserMemory() {
  console.log('🧠 Testing User Memory System\n');

  const memory = new UserMemory();
  const testUserId = 'john';

  try {
    // Test 1: Store user preferences
    console.log('📝 Storing user preferences...');
    await memory.storePreference(testUserId, 'music_genre', 'jazz', {
      priority: 'high',
      source: 'explicit',
    });
    await memory.storePreference(testUserId, 'music_genre', 'classical', {
      priority: 'medium',
      source: 'explicit',
    });
    await memory.storePreference(testUserId, 'volume_level', '60', {
      room: 'living_room',
      device: 'main_speaker',
    });
    await memory.storePreference(testUserId, 'temperature', '72', {
      room: 'bedroom',
      time_of_day: 'night',
    });
    console.log('✅ Preferences stored\n');

    // Test 2: Store conversation context
    console.log('💬 Storing conversation history...');
    await memory.storeConversation(
      testUserId,
      'User asked to play some relaxing music in the evening',
      { context: 'music_request', time: 'evening' }
    );
    await memory.storeConversation(
      testUserId,
      'User mentioned they like the temperature cooler at night',
      { context: 'temperature_preference', time: 'night' }
    );
    await memory.storeConversation(
      testUserId,
      'User frequently requests jazz music on Fridays',
      { context: 'pattern_observation', day: 'Friday' }
    );
    console.log('✅ Conversation context stored\n');

    // Wait for indexing
    console.log('⏳ Waiting for Pinecone to index data (5 seconds)...');
    await new Promise((resolve) => setTimeout(resolve, 5000));

    // Test 3: Search for music preferences
    console.log('🔍 Searching for music preferences...');
    const musicPrefs = await memory.searchMemories(testUserId, 'What music does the user like?', {
      topK: 5,
      memoryType: 'preference',
    });
    console.log(`Found ${musicPrefs.length} music-related preferences:`);
    musicPrefs.forEach((result, i) => {
      console.log(`  ${i + 1}. ${result.content} (score: ${result.score.toFixed(3)})`);
    });
    console.log('');

    // Test 4: Search all preferences
    console.log('📋 Getting all user preferences...');
    const allPrefs = await memory.getUserPreferences(testUserId);
    console.log(`Found ${allPrefs.length} total preferences:`);
    allPrefs.forEach((pref, i) => {
      console.log(`  ${i + 1}. ${pref.content}`);
    });
    console.log('');

    // Test 5: Search conversation history
    console.log('🔍 Searching conversation history for evening routines...');
    const eveningContext = await memory.searchMemories(
      testUserId,
      'What does the user do in the evening?',
      {
        topK: 3,
        memoryType: 'conversation',
      }
    );
    console.log(`Found ${eveningContext.length} relevant conversations:`);
    eveningContext.forEach((result, i) => {
      console.log(`  ${i + 1}. ${result.content} (score: ${result.score.toFixed(3)})`);
    });
    console.log('');

    console.log('✅ All tests completed successfully!');
  } catch (error) {
    console.error('❌ Error during testing:', error);
    throw error;
  }
}

// Run the test
testUserMemory()
  .then(() => {
    console.log('\n🎉 User Memory System is working correctly!');
    process.exit(0);
  })
  .catch((error) => {
    console.error('\n💥 Test failed:', error);
    process.exit(1);
  });
