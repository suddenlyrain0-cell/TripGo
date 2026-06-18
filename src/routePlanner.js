/**
 * @typedef {Object} SavedPlace
 * @property {string|number=} id
 * @property {string=} name
 * @property {number|string=} latitude
 * @property {number|string=} longitude
 * @property {number|string=} lat
 * @property {number|string=} lng
 * @property {{lat:number|string,lng:number|string}=} location
 * @property {string=} category
 * @property {number|string=} estimatedStayMinutes
 * @property {number|string=} estimatedStayTime
 * @property {number|string=} estimated_stay_minutes
 * @property {number|string=} priority
 * @property {string[]=} savedByUserIds
 * @property {string[]=} savedByUsers
 * @property {string[]=} saved_by_users
 */

const DEFAULT_CLUSTER_DISTANCE_KM = 3
const EARTH_RADIUS_KM = 6371

export const TRIP_PLANNER_DEFAULT_SETTINGS = {
  days: 2,
  startTime: '09:00',
  endTime: '21:00',
  intensity: 'normal',
  travelStyle: 'normal',
  transportMode: 'car',
  preserveSavedOrder: false
}

export const TRIP_INTENSITY_PROFILES = {
  relaxed: {
    label: '여유',
    minPlaces: 3,
    targetPlaces: 3,
    maxPlaces: 4,
    paceBuffer: 1.22,
    stayMultiplier: 1.16,
    breakMinutes: 25
  },
  normal: {
    label: '보통',
    minPlaces: 4,
    targetPlaces: 4,
    maxPlaces: 5,
    paceBuffer: 1,
    stayMultiplier: 1,
    breakMinutes: 12
  },
  packed: {
    label: '촘촘',
    minPlaces: 5,
    targetPlaces: 6,
    maxPlaces: 7,
    paceBuffer: 0.82,
    stayMultiplier: 0.9,
    breakMinutes: 5
  }
}

export const PLACE_CATEGORY_LABELS = {
  restaurant: '식사',
  cafe: '카페',
  viewpoint: '전망',
  night_view: '야경',
  bar: '바',
  museum: '전시',
  park: '공원',
  attraction: '관광',
  transport: '교통',
  hotel: '숙소',
  other: '기타'
}

const PLACE_CATEGORY_STAY_MINUTES = {
  restaurant: 75,
  cafe: 50,
  viewpoint: 45,
  night_view: 55,
  bar: 90,
  museum: 90,
  park: 75,
  attraction: 75,
  transport: 25,
  hotel: 30,
  other: 60
}

const TRANSPORT_SPEED_KMH = {
  walk: 4.5,
  transit: 18,
  car: 28
}

const TRANSPORT_BASE_MINUTES = {
  walk: 3,
  transit: 10,
  car: 8
}

function clampNumber(value, min, max, fallback) {
  const number = Number(value)
  if (!Number.isFinite(number)) return fallback
  return Math.min(max, Math.max(min, number))
}

function uniquePlaces(places) {
  const seen = new Set()
  return places.filter(place => {
    const key = place.plannerId || place.id || `${place.name}-${place.latitude}-${place.longitude}`
    if (seen.has(key)) return false
    seen.add(key)
    return true
  })
}

function getPoint(place) {
  const lat = Number(place?.latitude ?? place?.lat ?? place?.location?.lat)
  const lng = Number(place?.longitude ?? place?.lng ?? place?.location?.lng)
  return {
    lat,
    lng,
    latitude: lat,
    longitude: lng
  }
}

function isValidCoordinate(lat, lng) {
  const latitude = Number(lat)
  const longitude = Number(lng)
  return (
    Number.isFinite(latitude) &&
    Number.isFinite(longitude) &&
    latitude >= -90 &&
    latitude <= 90 &&
    longitude >= -180 &&
    longitude <= 180
  )
}

function isValidPoint(point) {
  const { latitude, longitude } = getPoint(point)
  return isValidCoordinate(latitude, longitude)
}

function getOptionalArray(value) {
  if (Array.isArray(value)) return value
  if (typeof value === 'string') return value.split(',').map(item => item.trim()).filter(Boolean)
  return []
}

function parseTimeToMinutes(value) {
  const [hours, minutes] = String(value || '').split(':').map(Number)
  if (!Number.isFinite(hours) || !Number.isFinite(minutes)) return null
  if (hours < 0 || hours > 23 || minutes < 0 || minutes > 59) return null
  return hours * 60 + minutes
}

function formatTimeFromMinutes(totalMinutes) {
  const normalized = Math.max(0, Math.round(totalMinutes))
  const hours = Math.floor(normalized / 60) % 24
  const minutes = normalized % 60
  return `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}`
}

export function formatDuration(minutes) {
  const rounded = Math.max(0, Math.round(minutes))
  const hours = Math.floor(rounded / 60)
  const rest = rounded % 60
  if (!hours) return `${rest}분`
  if (!rest) return `${hours}시간`
  return `${hours}시간 ${rest}분`
}

function normalizeOptions(options = {}) {
  const requestedStyle = options.travelStyle || options.intensity || TRIP_PLANNER_DEFAULT_SETTINGS.travelStyle
  const travelStyle = TRIP_INTENSITY_PROFILES[requestedStyle] ? requestedStyle : TRIP_PLANNER_DEFAULT_SETTINGS.travelStyle
  const transportMode = TRANSPORT_SPEED_KMH[options.transportMode] ? options.transportMode : TRIP_PLANNER_DEFAULT_SETTINGS.transportMode
  const startPoint = options.startLocation && isValidPoint(options.startLocation) ? getPoint(options.startLocation) : undefined

  return {
    ...TRIP_PLANNER_DEFAULT_SETTINGS,
    ...options,
    days: clampNumber(options.days, 1, 14, TRIP_PLANNER_DEFAULT_SETTINGS.days),
    startTime: parseTimeToMinutes(options.startTime) === null ? TRIP_PLANNER_DEFAULT_SETTINGS.startTime : options.startTime,
    endTime: parseTimeToMinutes(options.endTime) === null ? TRIP_PLANNER_DEFAULT_SETTINGS.endTime : options.endTime,
    intensity: travelStyle,
    travelStyle,
    transportMode,
    startLocation: startPoint,
    preserveSavedOrder: Boolean(options.preserveSavedOrder),
    maxDistanceKm: clampNumber(options.maxDistanceKm, 0.2, 30, DEFAULT_CLUSTER_DISTANCE_KM)
  }
}

function inferPlaceCategory(place) {
  const explicit = String(place?.category || '').trim().toLowerCase()
  if (PLACE_CATEGORY_LABELS[explicit]) return explicit

  const source = `${place?.category || ''} ${place?.tag || ''} ${place?.name || ''} ${place?.memo || ''}`.toLowerCase()
  if (/맛집|식당|음식|레스토랑|밥|브런치|restaurant|dining|food/.test(source)) return 'restaurant'
  if (/카페|커피|cafe|coffee/.test(source)) return 'cafe'
  if (/야경|night/.test(source)) return 'night_view'
  if (/전망|뷰|view|viewpoint|observatory/.test(source)) return 'viewpoint'
  if (/술집|와인|칵테일|호프|펍|bar|pub/.test(source)) return 'bar'
  if (/박물관|미술관|전시|museum|gallery/.test(source)) return 'museum'
  if (/공원|수목원|park|garden/.test(source)) return 'park'
  if (/숙소|호텔|hotel|stay/.test(source)) return 'hotel'
  if (/역|공항|터미널|교통|station|airport|terminal|transport/.test(source)) return 'transport'
  if (/관광|명소|궁|마을|해변|시장|attraction|tour/.test(source)) return 'attraction'
  return place?.category || place?.tag ? 'attraction' : 'other'
}

function getEstimatedStayMinutes(place, category) {
  return clampNumber(
    place?.estimatedStayMinutes ?? place?.estimatedStayTime ?? place?.estimated_stay_minutes ?? place?.estimated_stay_time,
    0,
    240,
    PLACE_CATEGORY_STAY_MINUTES[category] || PLACE_CATEGORY_STAY_MINUTES.other
  )
}

function normalizePlace(place, index = 0) {
  const point = getPoint(place)
  const category = inferPlaceCategory(place)
  const savedByUserIds = getOptionalArray(place?.savedByUserIds ?? place?.savedByUsers ?? place?.saved_by_users)
  const priority = clampNumber(place?.priority, 1, 5, Math.min(5, Math.max(1, savedByUserIds.length || 1)))
  const estimatedStayMinutes = getEstimatedStayMinutes(place, category)

  return {
    ...place,
    id: place?.id ?? place?.plannerId ?? `place-${index}`,
    plannerId: String(place?.plannerId ?? place?.id ?? `place-${index}`),
    name: place?.name || '이름 없는 장소',
    latitude: point.latitude,
    longitude: point.longitude,
    lat: point.latitude,
    lng: point.longitude,
    category,
    estimatedStayMinutes,
    estimatedStayTime: estimatedStayMinutes,
    priority,
    savedByUserIds,
    savedByUsers: savedByUserIds,
    validCoordinate: isValidCoordinate(point.latitude, point.longitude)
  }
}

function getNorthWestPlace(places) {
  return [...places].sort((a, b) => {
    if (a.longitude !== b.longitude) return a.longitude - b.longitude
    return b.latitude - a.latitude
  })[0]
}

function getClusterCentroid(cluster) {
  return {
    latitude: cluster.reduce((sum, place) => sum + place.latitude, 0) / cluster.length,
    longitude: cluster.reduce((sum, place) => sum + place.longitude, 0) / cluster.length
  }
}

function estimateTravelMinutes(distanceKm, options) {
  if (!Number.isFinite(distanceKm) || distanceKm <= 0) return 0
  const profile = TRIP_INTENSITY_PROFILES[options.travelStyle] || TRIP_INTENSITY_PROFILES.normal
  const speed = TRANSPORT_SPEED_KMH[options.transportMode] || TRANSPORT_SPEED_KMH.car
  const base = TRANSPORT_BASE_MINUTES[options.transportMode] || TRANSPORT_BASE_MINUTES.car
  return Math.max(3, Math.round((base + (distanceKm / speed) * 60) * profile.paceBuffer))
}

function adjustArrivalForCategory(minutes, category) {
  if (category === 'restaurant') {
    if (minutes < 11 * 60 + 30) return 11 * 60 + 30
    if (minutes > 14 * 60 && minutes < 17 * 60 + 30) return 17 * 60 + 30
  }
  if (category === 'cafe' && minutes < 13 * 60 + 30) return 13 * 60 + 30
  if (['night_view', 'bar'].includes(category) && minutes < 18 * 60) return 18 * 60
  return minutes
}

function insertAt(array, index, item) {
  array.splice(Math.min(Math.max(index, 0), array.length), 0, item)
}

function buildOverallExplanation(routePlan, options) {
  const scheduledPlaces = routePlan.days.flatMap(day => day.places)
  if (scheduledPlaces.length === 0) return '좌표가 있는 저장 장소가 없어 코스를 만들지 못했어요.'

  const profile = TRIP_INTENSITY_PROFILES[options.travelStyle] || TRIP_INTENSITY_PROFILES.normal
  const hasRestaurant = scheduledPlaces.some(place => place.category === 'restaurant')
  const hasCafe = scheduledPlaces.some(place => place.category === 'cafe')
  const hasEvening = scheduledPlaces.some(place => ['night_view', 'bar'].includes(place.category))
  const styleText = `${profile.label} 강도로 하루 ${profile.minPlaces}~${profile.maxPlaces}곳 안에서`
  const mealText = hasRestaurant ? ', 식사 장소를 점심이나 저녁 시간 근처에 배치했고' : ''
  const cafeText = hasCafe ? ', 카페는 식사 뒤나 오후 휴식 흐름에 넣었고' : ''
  const endingText = hasEvening ? ', 야경/바처럼 저녁에 어울리는 장소는 뒤쪽으로 보냈어요' : ' 전체 동선이 자연스럽게 이어지도록 정리했어요'
  return `저장한 장소를 가까운 지역끼리 묶고 ${styleText} 이동 부담을 줄였고${mealText}${cafeText}${endingText}.`
}

function markExcluded(place, reason) {
  return {
    ...place,
    _excludeReason: reason
  }
}

export function validatePlaces(places = []) {
  const warnings = []
  const validPlaces = []
  const excludedPlaces = []

  if (!Array.isArray(places)) {
    return {
      validPlaces,
      excludedPlaces,
      warnings: ['장소 목록 형식이 올바르지 않아요.']
    }
  }

  places.forEach((place, index) => {
    const normalized = normalizePlace(place, index)
    if (normalized.validCoordinate) validPlaces.push(normalized)
    else excludedPlaces.push(markExcluded(normalized, 'invalid_coordinate'))
  })

  if (excludedPlaces.length > 0) warnings.push(`좌표가 없거나 잘못된 장소 ${excludedPlaces.length}곳은 코스 계산에서 제외했어요.`)

  return {
    validPlaces,
    excludedPlaces,
    warnings
  }
}

export function calculateDistanceKm(pointA, pointB) {
  const a = getPoint(pointA)
  const b = getPoint(pointB)
  if (!isValidCoordinate(a.latitude, a.longitude) || !isValidCoordinate(b.latitude, b.longitude)) return Number.POSITIVE_INFINITY

  const toRad = value => (Number(value) * Math.PI) / 180
  const dLat = toRad(b.latitude - a.latitude)
  const dLng = toRad(b.longitude - a.longitude)
  const lat1 = toRad(a.latitude)
  const lat2 = toRad(b.latitude)
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLng / 2) ** 2
  return EARTH_RADIUS_KM * 2 * Math.atan2(Math.sqrt(h), Math.sqrt(1 - h))
}

export function clusterPlacesByDistance(places = [], maxDistanceKm = DEFAULT_CLUSTER_DISTANCE_KM) {
  const sourcePlaces = Array.isArray(places) ? places : []
  const normalized = sourcePlaces.map((place, index) => normalizePlace(place, index)).filter(place => place.validCoordinate)
  const byId = new Map(normalized.map(place => [place.plannerId, place]))
  const unvisited = new Set(byId.keys())
  const clusters = []

  while (unvisited.size > 0) {
    const seedId = unvisited.values().next().value
    const seed = byId.get(seedId)
    const queue = [seed]
    const cluster = [seed]
    unvisited.delete(seedId)

    while (queue.length > 0) {
      const current = queue.shift()
      Array.from(unvisited).forEach(candidateId => {
        const candidate = byId.get(candidateId)
        if (calculateDistanceKm(current, candidate) <= maxDistanceKm) {
          unvisited.delete(candidateId)
          queue.push(candidate)
          cluster.push(candidate)
        }
      })
    }

    clusters.push(cluster.sort((a, b) => b.priority - a.priority))
  }

  return clusters.sort((a, b) => {
    const aCenter = getClusterCentroid(a)
    const bCenter = getClusterCentroid(b)
    if (aCenter.longitude !== bCenter.longitude) return aCenter.longitude - bCenter.longitude
    return bCenter.latitude - aCenter.latitude
  })
}

export function distributePlacesByDays(clusters = [], days = 1, travelStyle = 'normal') {
  const profile = TRIP_INTENSITY_PROFILES[travelStyle] || TRIP_INTENSITY_PROFILES.normal
  const sourceClusters = Array.isArray(clusters) ? clusters : []
  const dayCount = clampNumber(days, 1, 14, 1)
  const dayPlaces = Array.from({ length: dayCount }, () => [])
  const overflow = []
  let cursor = 0

  sourceClusters.forEach(cluster => {
    const remaining = [...cluster].sort((a, b) => b.priority - a.priority)

    while (remaining.length > 0) {
      const preferredDay = findAvailableDay(dayPlaces, cursor, profile.targetPlaces)
      const fallbackDay = preferredDay === -1 ? findAvailableDay(dayPlaces, cursor, profile.maxPlaces) : preferredDay

      if (fallbackDay === -1) {
        overflow.push(...remaining)
        break
      }

      const bucket = dayPlaces[fallbackDay]
      const hardSpace = profile.maxPlaces - bucket.length
      const targetSpace = Math.max(1, profile.targetPlaces - bucket.length)
      const takeCount = Math.min(hardSpace, targetSpace, remaining.length)
      bucket.push(...remaining.splice(0, takeCount))
      cursor = (fallbackDay + 1) % dayCount
    }
  })

  return {
    days: dayPlaces,
    overflow
  }
}

function distributeSequentialPlacesByDays(places = [], days = 1, travelStyle = 'normal') {
  const profile = TRIP_INTENSITY_PROFILES[travelStyle] || TRIP_INTENSITY_PROFILES.normal
  const sourcePlaces = Array.isArray(places) ? places : []
  const dayCount = clampNumber(days, 1, 14, 1)
  const dayPlaces = Array.from({ length: dayCount }, () => [])
  const overflow = []
  let dayIndex = 0

  sourcePlaces.forEach(place => {
    if (dayPlaces[dayIndex].length >= profile.targetPlaces && dayIndex < dayCount - 1) {
      dayIndex += 1
    }

    if (dayPlaces[dayIndex].length < profile.maxPlaces) {
      dayPlaces[dayIndex].push(place)
      return
    }

    const fallbackDay = findAvailableDay(dayPlaces, dayIndex, profile.maxPlaces)
    if (fallbackDay === -1) {
      overflow.push(place)
      return
    }

    dayPlaces[fallbackDay].push(place)
    dayIndex = fallbackDay
  })

  return {
    days: dayPlaces,
    overflow
  }
}

function findAvailableDay(dayPlaces, cursor, limit) {
  for (let offset = 0; offset < dayPlaces.length; offset += 1) {
    const index = (cursor + offset) % dayPlaces.length
    if (dayPlaces[index].length < limit) return index
  }
  return -1
}

export function sortByNearestNeighbor(places = [], startLocation) {
  const sourcePlaces = Array.isArray(places) ? places : []
  const remaining = sourcePlaces.map((place, index) => normalizePlace(place, index)).filter(place => place.validCoordinate)
  if (remaining.length <= 1) return remaining

  const ordered = []
  let currentPoint = startLocation && isValidPoint(startLocation) ? getPoint(startLocation) : null

  if (!currentPoint) {
    const start = getNorthWestPlace(remaining)
    ordered.push(start)
    remaining.splice(remaining.findIndex(place => place.plannerId === start.plannerId), 1)
    currentPoint = start
  }

  while (remaining.length > 0) {
    const nearest = remaining
      .map(place => ({ place, distance: calculateDistanceKm(currentPoint, place) }))
      .sort((a, b) => a.distance - b.distance)[0].place
    ordered.push(nearest)
    remaining.splice(remaining.findIndex(place => place.plannerId === nearest.plannerId), 1)
    currentPoint = nearest
  }

  return ordered
}

export function adjustByTravelContext(places = [], options = {}) {
  const ordered = Array.isArray(places) ? [...places] : []
  const restaurants = ordered.filter(place => place.category === 'restaurant')
  const cafes = ordered.filter(place => place.category === 'cafe')
  const nightViews = ordered.filter(place => place.category === 'night_view')
  const bars = ordered.filter(place => place.category === 'bar')
  const daytime = ordered.filter(place => !['restaurant', 'cafe', 'night_view', 'bar'].includes(place.category))
  const result = [...daytime]
  const startMinutes = parseTimeToMinutes(options.startTime) ?? 9 * 60
  const endMinutesRaw = parseTimeToMinutes(options.endTime) ?? 21 * 60
  const endMinutes = endMinutesRaw <= startMinutes ? endMinutesRaw + 24 * 60 : endMinutesRaw
  const longDay = endMinutes - startMinutes >= 10 * 60
  const lunchIndex = Math.min(result.length, Math.max(1, Math.floor((result.length + restaurants.length + cafes.length) * 0.45)))
  const cafeIndex = Math.min(result.length, Math.max(lunchIndex + 1, Math.floor((result.length + cafes.length) * 0.65)))

  if (restaurants[0]) insertAt(result, lunchIndex, restaurants[0])
  if (cafes[0]) insertAt(result, cafeIndex, cafes[0])
  if (restaurants[1]) insertAt(result, longDay ? result.length : Math.max(0, result.length - 1), restaurants[1])

  result.push(...restaurants.slice(2), ...cafes.slice(1), ...nightViews, ...bars)
  return result
}

export function buildDayRoute(places = [], day = 1, options = {}) {
  const safeOptions = normalizeOptions(options)
  const profile = TRIP_INTENSITY_PROFILES[safeOptions.travelStyle] || TRIP_INTENSITY_PROFILES.normal
  const { validPlaces } = validatePlaces(places)
  const ordered = safeOptions.preserveSavedOrder
    ? validPlaces
    : adjustByTravelContext(sortByNearestNeighbor(validPlaces, safeOptions.startLocation), safeOptions)
  const start = parseTimeToMinutes(safeOptions.startTime) ?? 9 * 60
  const rawEnd = parseTimeToMinutes(safeOptions.endTime) ?? 21 * 60
  const end = rawEnd <= start ? rawEnd + 24 * 60 : rawEnd
  const scheduled = []
  const overflowPlaces = []
  let totalDistanceKm = 0
  let estimatedTravelMinutes = 0
  let cursor = start
  let previousPoint = safeOptions.startLocation || null

  ordered.forEach((place, index) => {
    const distanceFromPreviousKm = previousPoint ? calculateDistanceKm(previousPoint, place) : 0
    const travelMinutes = previousPoint ? estimateTravelMinutes(distanceFromPreviousKm, safeOptions) : 0
    const arrival = adjustArrivalForCategory(cursor + travelMinutes, place.category)
    const stayMinutes = Math.max(15, Math.round(place.estimatedStayMinutes * profile.stayMultiplier))
    const leave = arrival + stayMinutes
    const restMinutes = index < ordered.length - 1 ? profile.breakMinutes : 0
    const minimumToKeep = Math.max(1, Math.min(profile.minPlaces - 1, ordered.length))

    if (leave + restMinutes > end && scheduled.length >= minimumToKeep) {
      overflowPlaces.push(markExcluded(place, 'time_window'))
      return
    }

    totalDistanceKm += Number.isFinite(distanceFromPreviousKm) ? distanceFromPreviousKm : 0
    estimatedTravelMinutes += travelMinutes
    scheduled.push({
      ...place,
      order: scheduled.length + 1,
      recommendedStartTime: formatTimeFromMinutes(arrival),
      recommendedEndTime: formatTimeFromMinutes(leave),
      distanceFromPreviousKm: Number(distanceFromPreviousKm.toFixed(2)),
      travelMinutes,
      estimatedStayMinutes: stayMinutes,
      estimatedStayTime: stayMinutes,
      restMinutes,
      categoryLabel: PLACE_CATEGORY_LABELS[place.category] || PLACE_CATEGORY_LABELS.other
    })
    cursor = leave + restMinutes
    previousPoint = place
  })

  const dayRoute = {
    day,
    places: scheduled,
    totalDistanceKm: Number(totalDistanceKm.toFixed(2)),
    estimatedTravelMinutes,
    usedMinutes: Math.max(0, cursor - start),
    overflowPlaces
  }

  return {
    ...dayRoute,
    explanation: generateRouteExplanation(dayRoute)
  }
}

export function generateRouteExplanation(dayRoute) {
  if (!dayRoute.places.length) return '이 날은 추천할 장소가 없어요.'

  const hasRestaurant = dayRoute.places.some(place => place.category === 'restaurant')
  const hasCafe = dayRoute.places.some(place => place.category === 'cafe')
  const hasEvening = dayRoute.places.some(place => ['night_view', 'bar'].includes(place.category))
  const distanceText = dayRoute.totalDistanceKm <= 3
    ? '가까운 장소끼리 묶여 있어 이동 부담이 적고'
    : '동선이 이어지도록 가까운 순서부터 정리했고'
  const mealText = hasRestaurant ? ', 식사 시간대에 식당을 배치해' : ''
  const cafeText = hasCafe ? ', 카페를 오후 휴식 흐름에 넣어' : ''
  const eveningText = hasEvening ? ', 저녁형 장소는 뒤쪽에 배치해' : ''
  return `이 코스는 ${distanceText}${mealText}${cafeText}${eveningText} 자연스러운 흐름으로 여행할 수 있어요.`
}

export function buildRoutePlan({ places = [], options = {} } = {}) {
  const safeOptions = normalizeOptions(options)
  const { validPlaces, excludedPlaces, warnings } = validatePlaces(places)
  const placeCount = Array.isArray(places) ? places.length : 0
  const nextWarnings = [...warnings]

  if (placeCount === 0) nextWarnings.push('저장한 장소가 없습니다.')
  if (placeCount > 0 && validPlaces.length === 0) nextWarnings.push('좌표가 있는 저장 장소가 없습니다.')

  const distributed = safeOptions.preserveSavedOrder
    ? distributeSequentialPlacesByDays(validPlaces, safeOptions.days, safeOptions.travelStyle)
    : distributePlacesByDays(clusterPlacesByDistance(validPlaces, safeOptions.maxDistanceKm), safeOptions.days, safeOptions.travelStyle)
  const dayRoutesWithOverflow = distributed.days.map((dayPlaces, index) => buildDayRoute(dayPlaces, index + 1, safeOptions))
  const scheduleOverflow = dayRoutesWithOverflow.flatMap(day => day.overflowPlaces || [])
  const scheduledIds = new Set(dayRoutesWithOverflow.flatMap(day => day.places.map(place => place.plannerId)))
  const additionalExcluded = uniquePlaces([...distributed.overflow.map(place => markExcluded(place, 'capacity')), ...scheduleOverflow])
    .filter(place => !scheduledIds.has(place.plannerId))

  if (additionalExcluded.length > 0) nextWarnings.push(`일정 강도와 시간 안에 넣기 어려운 장소 ${additionalExcluded.length}곳은 제외했어요.`)

  const routePlan = {
    days: dayRoutesWithOverflow.map(({ overflowPlaces, ...dayRoute }) => dayRoute),
    excludedPlaces: [...excludedPlaces, ...additionalExcluded],
    warnings: nextWarnings
  }

  return routePlan
}

export function buildTripPlan(places, settings = {}) {
  const safeOptions = normalizeOptions({
    ...settings,
    travelStyle: settings.travelStyle || settings.intensity || TRIP_PLANNER_DEFAULT_SETTINGS.travelStyle,
    transportMode: settings.transportMode || TRIP_PLANNER_DEFAULT_SETTINGS.transportMode
  })
  const routePlan = buildRoutePlan({ places, options: safeOptions })
  const { validPlaces } = validatePlaces(places)
  const invalidPlaces = routePlan.excludedPlaces.filter(place => place._excludeReason === 'invalid_coordinate')
  const unscheduled = routePlan.excludedPlaces.filter(place => place._excludeReason !== 'invalid_coordinate')
  const days = routePlan.days.map(day => ({
    day: day.day,
    items: day.places.map(place => ({
      place,
      categoryLabel: place.categoryLabel || PLACE_CATEGORY_LABELS[place.category] || PLACE_CATEGORY_LABELS.other,
      travelKm: place.distanceFromPreviousKm || 0,
      travelMinutes: place.travelMinutes || 0,
      startTime: place.recommendedStartTime || safeOptions.startTime,
      endTime: place.recommendedEndTime || safeOptions.startTime,
      stayMinutes: place.estimatedStayMinutes || PLACE_CATEGORY_STAY_MINUTES[place.category] || PLACE_CATEGORY_STAY_MINUTES.other,
      restMinutes: place.restMinutes || 0
    })),
    distanceKm: day.totalDistanceKm,
    usedMinutes: day.usedMinutes || 0,
    explanation: day.explanation
  }))
  const plan = {
    settings: {
      ...TRIP_PLANNER_DEFAULT_SETTINGS,
      ...settings,
      days: safeOptions.days,
      startTime: safeOptions.startTime,
      endTime: safeOptions.endTime,
      intensity: safeOptions.travelStyle,
      travelStyle: safeOptions.travelStyle,
      transportMode: safeOptions.transportMode
    },
    days,
    validPlaces,
    invalidPlaces,
    unscheduled,
    warnings: routePlan.warnings
  }

  return {
    ...plan,
    explanation: buildOverallExplanation(routePlan, safeOptions)
  }
}
