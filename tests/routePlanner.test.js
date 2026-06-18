import test from 'node:test'
import assert from 'node:assert/strict'
import {
  buildRoutePlan,
  calculateDistanceKm,
  validatePlaces
} from '../src/routePlanner.js'

const baseOptions = {
  days: 2,
  startTime: '09:00',
  endTime: '21:00',
  travelStyle: 'normal',
  transportMode: 'car'
}

function makePlace(id, lat, lng, category = 'attraction') {
  return {
    id,
    name: `장소 ${id}`,
    lat,
    lng,
    category
  }
}

test('calculateDistanceKm uses Haversine distance', () => {
  const same = calculateDistanceKm({ lat: 37.5665, lng: 126.978 }, { lat: 37.5665, lng: 126.978 })
  assert.equal(same, 0)

  const seoulToBusan = calculateDistanceKm(
    { lat: 37.5665, lng: 126.978 },
    { lat: 35.1796, lng: 129.0756 }
  )
  assert.ok(seoulToBusan > 320 && seoulToBusan < 340)
})

test('validatePlaces excludes missing or invalid coordinates', () => {
  const result = validatePlaces([
    makePlace('valid', 37.5665, 126.978),
    { id: 'missing', name: '좌표 없음' },
    makePlace('invalid', 999, 126.978)
  ])

  assert.equal(result.validPlaces.length, 1)
  assert.equal(result.excludedPlaces.length, 2)
  assert.equal(result.excludedPlaces[0]._excludeReason, 'invalid_coordinate')
})

test('buildRoutePlan handles zero places', () => {
  const plan = buildRoutePlan({ places: [], options: baseOptions })

  assert.equal(plan.days.length, 2)
  assert.equal(plan.days.flatMap(day => day.places).length, 0)
  assert.ok(plan.warnings.some(warning => warning.includes('저장한 장소')))
})

test('buildRoutePlan handles one place', () => {
  const plan = buildRoutePlan({
    places: [makePlace('a', 37.5665, 126.978)],
    options: baseOptions
  })

  const scheduled = plan.days.flatMap(day => day.places)
  assert.equal(plan.days.length, 2)
  assert.equal(scheduled.length, 1)
  assert.equal(scheduled[0].order, 1)
  assert.equal(scheduled[0].distanceFromPreviousKm, 0)
})

test('buildRoutePlan keeps all days when days are more than places', () => {
  const plan = buildRoutePlan({
    places: [
      makePlace('a', 37.5665, 126.978),
      makePlace('b', 37.5651, 126.98955)
    ],
    options: { ...baseOptions, days: 5 }
  })

  assert.equal(plan.days.length, 5)
  assert.equal(plan.days.flatMap(day => day.places).length, 2)
})

test('travelStyle changes how many places are packed into one day', () => {
  const places = Array.from({ length: 7 }, (_, index) => (
    makePlace(String(index), 37.5665 + index * 0.001, 126.978 + index * 0.001)
  ))

  const relaxed = buildRoutePlan({
    places,
    options: { ...baseOptions, days: 1, travelStyle: 'relaxed' }
  })
  const packed = buildRoutePlan({
    places,
    options: { ...baseOptions, days: 1, travelStyle: 'packed' }
  })

  assert.ok(relaxed.days[0].places.length < packed.days[0].places.length)
  assert.equal(packed.days[0].places.length, 7)
})

test('preserveSavedOrder keeps the saved place order in the itinerary', () => {
  const places = [
    makePlace('third', 37.5685, 126.98),
    makePlace('first', 37.5665, 126.978),
    makePlace('second', 37.5675, 126.979)
  ]

  const plan = buildRoutePlan({
    places,
    options: { ...baseOptions, days: 1, travelStyle: 'packed', preserveSavedOrder: true }
  })

  assert.deepEqual(plan.days[0].places.map(place => place.id), ['third', 'first', 'second'])
})
