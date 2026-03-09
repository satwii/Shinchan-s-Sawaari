[Console]::OutputEncoding = [System.Text.Encoding]::UTF8
$ErrorActionPreference = "Continue"
$BASE = "http://localhost:5000/api"
$PASS_COUNT = 0
$FAIL_COUNT = 0
$SKIP_COUNT = 0

function Test-API($Method, $Url, $Body, $Token, $TestName) {
    Write-Host ""
    Write-Host "--- TEST: $TestName ---" -ForegroundColor Cyan
    $headers = @{ "Content-Type" = "application/json" }
    if ($Token) { $headers["Authorization"] = "Bearer $Token" }
    
    try {
        $params = @{
            Method = $Method
            Uri = "$BASE$Url"
            Headers = $headers
            UseBasicParsing = $true
        }
        if ($Body) {
            $jsonBody = ($Body | ConvertTo-Json -Depth 10)
            $params["Body"] = [System.Text.Encoding]::UTF8.GetBytes($jsonBody)
        }
        
        $response = Invoke-WebRequest @params
        $parsed = $response.Content | ConvertFrom-Json
        $content = $parsed | ConvertTo-Json -Depth 10 -Compress
        Write-Host "  PASS ($($response.StatusCode))" -ForegroundColor Green
        if ($content.Length -gt 300) {
            Write-Host "  $($content.Substring(0, 300))..." -ForegroundColor Gray
        } else {
            Write-Host "  $content" -ForegroundColor Gray
        }
        $script:PASS_COUNT++
        return $parsed
    } catch {
        $statusCode = $_.Exception.Response.StatusCode.value__
        $errorBody = ""
        try {
            $reader = [System.IO.StreamReader]::new($_.Exception.Response.GetResponseStream())
            $errorBody = $reader.ReadToEnd()
        } catch {}
        Write-Host "  FAIL ($statusCode)" -ForegroundColor Red
        Write-Host "  $errorBody" -ForegroundColor Yellow
        $script:FAIL_COUNT++
        return $null
    }
}

Write-Host "================================================" -ForegroundColor Magenta
Write-Host "   SAWAARI - COMPLETE FEATURE TEST SUITE" -ForegroundColor Magenta
Write-Host "================================================" -ForegroundColor Magenta

# ============================================================
# 1. HEALTH CHECK
# ============================================================
Write-Host "`n[SECTION 1] HEALTH CHECK" -ForegroundColor Yellow
Test-API "GET" "/health" $null $null "Backend Health Check"

# ============================================================
# 2. SIGNUP FLOW - USER A (Owner, Male)
# ============================================================
Write-Host "`n[SECTION 2] SIGNUP FLOW - User A (Male, Ride Owner)" -ForegroundColor Yellow

$phoneA = "5551112222"
$aadhaarA = "276543082797"
$aadhaarA_last4 = "2797"

Test-API "POST" "/auth/check-phone" @{ phone = $phoneA } $null "Step 1: Check Phone"
Test-API "POST" "/auth/send-aadhaar-otp" @{ phone = $phoneA; aadhaar = $aadhaarA } $null "Step 2: Send Aadhaar OTP"
$resultA_otp = Test-API "POST" "/auth/verify-aadhaar-otp" @{ phone = $phoneA; otp = "123456"; aadhaarLast4 = $aadhaarA_last4 } $null "Step 3: Verify OTP"

$tokenA = $null

if ($resultA_otp -and $resultA_otp.isLogin -eq $true) {
    $tokenA = $resultA_otp.token
    Write-Host "  >> User A: Existing user, logged in" -ForegroundColor DarkGray
} elseif ($resultA_otp -and $resultA_otp.needsRegistration -eq $true) {
    $resultA_reg = Test-API "POST" "/auth/register" @{
        phone = $phoneA
        otp = "123456"
        username = "TestOwnerX"
        gender = "Male"
        age = 28
        emergencyContactName = "Mom"
        emergencyContactPhone = "9111111111"
    } $null "Step 4-5: Register User A"
    if ($resultA_reg) { $tokenA = $resultA_reg.token }
}

if (-not $tokenA) {
    Write-Host "  CRITICAL: Could not get token A!" -ForegroundColor Red
    exit 1
}
Write-Host "  >> Token A: OK" -ForegroundColor DarkGray

# ============================================================
# 3. SIGNUP FLOW - USER B (Female joiner)
# ============================================================
Write-Host "`n[SECTION 3] SIGNUP FLOW - User B (Female, Joiner)" -ForegroundColor Yellow

$phoneB = "5553334444"
$aadhaarB = "561312315407"
$aadhaarB_last4 = "5407"

Test-API "POST" "/auth/check-phone" @{ phone = $phoneB } $null "Step 1: Check Phone"
Test-API "POST" "/auth/send-aadhaar-otp" @{ phone = $phoneB; aadhaar = $aadhaarB } $null "Step 2: Send Aadhaar OTP"
$resultB_otp = Test-API "POST" "/auth/verify-aadhaar-otp" @{ phone = $phoneB; otp = "123456"; aadhaarLast4 = $aadhaarB_last4 } $null "Step 3: Verify OTP"

$tokenB = $null

if ($resultB_otp -and $resultB_otp.isLogin -eq $true) {
    $tokenB = $resultB_otp.token
    Write-Host "  >> User B: Existing user, logged in" -ForegroundColor DarkGray
} elseif ($resultB_otp -and $resultB_otp.needsRegistration -eq $true) {
    $resultB_reg = Test-API "POST" "/auth/register" @{
        phone = $phoneB
        otp = "123456"
        username = "TestJoinerY"
        gender = "Female"
        age = 24
        emergencyContactName = "Dad"
        emergencyContactPhone = "9222222222"
    } $null "Step 4-5: Register User B"
    if ($resultB_reg) { $tokenB = $resultB_reg.token }
}

if (-not $tokenB) {
    Write-Host "  CRITICAL: Could not get token B!" -ForegroundColor Red
    exit 1
}
Write-Host "  >> Token B: OK" -ForegroundColor DarkGray

# ============================================================
# 4. PROFILE RETRIEVAL + BADGES
# ============================================================
Write-Host "`n[SECTION 4] PROFILE RETRIEVAL + BADGES" -ForegroundColor Yellow
$profileA = Test-API "GET" "/auth/me" $null $tokenA "Get Profile A"
$profileB = Test-API "GET" "/auth/me" $null $tokenB "Get Profile B"

# ============================================================
# 5. RIDE REGISTRATION
# ============================================================
Write-Host "`n[SECTION 5] RIDE REGISTRATION" -ForegroundColor Yellow
$rideDate = (Get-Date).AddDays(1).ToString("yyyy-MM-dd")
$resultRide = Test-API "POST" "/rides/register" @{
    source = "Ameerpet"
    destination = "HITEC City"
    date = $rideDate
    rideTime = "09:30"
    vehicleType = "Cab"
    seatsAvailable = 4
    maleCount = 1
    femaleCount = 0
    pinkMode = $false
} $tokenA "Register Ride (Owner A)"

$rideId = $null
if ($resultRide -and $resultRide.ride) { $rideId = $resultRide.ride.id }
Write-Host "  >> Ride ID: $rideId" -ForegroundColor DarkGray

if (-not $rideId) {
    Write-Host "  CRITICAL: Could not create ride!" -ForegroundColor Red
    exit 1
}

# ============================================================
# 6. RIDE SEARCH
# ============================================================
Write-Host "`n[SECTION 6] RIDE SEARCH" -ForegroundColor Yellow
$searchResult = Test-API "POST" "/rides/search" @{
    source = "Ameerpet"
    destination = "HITEC City"
    date = $rideDate
} $tokenB "Search Rides (User B)"

if ($searchResult -and $searchResult.rides.Count -gt 0) {
    Write-Host "  >> Found $($searchResult.rides.Count) ride(s)" -ForegroundColor Green
} else {
    Write-Host "  >> No rides found!" -ForegroundColor Red
}

# ============================================================
# 7. RIDE DETAIL VIEW
# ============================================================
Write-Host "`n[SECTION 7] RIDE DETAIL VIEW" -ForegroundColor Yellow
Test-API "GET" "/rides/$rideId/detail" $null $tokenA "View Ride as Owner"
Test-API "GET" "/rides/$rideId/detail" $null $tokenB "View Ride as Outsider"

# ============================================================
# 8. RIDE REQUEST + ACCEPTANCE (Mutual Consent)
# ============================================================
Write-Host "`n[SECTION 8] RIDE REQUEST + ACCEPTANCE" -ForegroundColor Yellow

$reqResult = Test-API "POST" "/rides/$rideId/request" $null $tokenB "B sends Join Request"

# Get request ID from the requests list
$requestsResult = Test-API "GET" "/rides/$rideId/requests" $null $tokenA "Owner A views Pending Requests"

$requestId = $null
if ($requestsResult -and $requestsResult.requests) {
    $pendingReq = $requestsResult.requests | Where-Object { $_.status -eq "pending" } | Select-Object -First 1
    if ($pendingReq) { $requestId = $pendingReq.id }
}

if ($requestId) {
    Test-API "POST" "/rides/$rideId/requests/$requestId/respond" @{ action = "accept" } $tokenA "Owner A Accepts Request"
} else {
    Write-Host "  SKIP: No pending requestId found" -ForegroundColor Yellow
    $script:SKIP_COUNT++
}

$membersResult = Test-API "GET" "/rides/$rideId/members" $null $tokenA "Verify B is now a Member"
if ($membersResult -and $membersResult.members) {
    $memberNames = $membersResult.members | ForEach-Object { $_.username }
    Write-Host "  >> Members: $($memberNames -join ', ')" -ForegroundColor DarkGray
}

# ============================================================
# 9. MY RIDES
# ============================================================
Write-Host "`n[SECTION 9] MY RIDES" -ForegroundColor Yellow
Test-API "GET" "/rides/my" $null $tokenA "My Rides (Owner A)"
Test-API "GET" "/rides/my" $null $tokenB "My Rides (Joiner B)"

# ============================================================
# 10. VEHICLE REG + TRIP START
# ============================================================
Write-Host "`n[SECTION 10] VEHICLE REG + TRIP START" -ForegroundColor Yellow
$startResult = Test-API "POST" "/rides/$rideId/start-trip" @{ vehicleReg = "TN 11 AB 1234" } $tokenA "Start Trip"

$rideAfterStart = Test-API "GET" "/rides/$rideId/detail" $null $tokenA "Verify trip_started=true"
if ($rideAfterStart -and $rideAfterStart.ride.trip_started) {
    Write-Host "  >> Trip is ACTIVE" -ForegroundColor Green
} else {
    Write-Host "  >> Trip NOT started!" -ForegroundColor Red
}

# ============================================================
# 11. GPS LIVE TRACKING
# ============================================================
Write-Host "`n[SECTION 11] GPS LIVE TRACKING" -ForegroundColor Yellow
Test-API "POST" "/rides/$rideId/track" @{ lat = 17.4399; lng = 78.4983 } $tokenA "Owner sends GPS loc 1"

$trackResult = Test-API "GET" "/rides/$rideId/tracking" $null $tokenB "Member B gets tracking"
if ($trackResult -and $trackResult.latest) {
    Write-Host "  >> Lat: $($trackResult.latest.lat), Lng: $($trackResult.latest.lng)" -ForegroundColor DarkGray
}

Test-API "POST" "/rides/$rideId/track" @{ lat = 17.4450; lng = 78.5010 } $tokenA "Owner sends GPS loc 2 (movement)"

$trackResult2 = Test-API "GET" "/rides/$rideId/tracking" $null $tokenB "Member B sees updated position"
if ($trackResult2 -and $trackResult2.latest) {
    Write-Host "  >> Updated - Lat: $($trackResult2.latest.lat), Lng: $($trackResult2.latest.lng)" -ForegroundColor DarkGray
}

# ============================================================
# 12. PUBLIC TRACKING LINK (Shareable)
# ============================================================
Write-Host "`n[SECTION 12] PUBLIC TRACKING LINK" -ForegroundColor Yellow
$trackToken = $null
if ($rideAfterStart -and $rideAfterStart.ride) {
    $trackToken = $rideAfterStart.ride.tracking_token
}
if ($trackToken) {
    Write-Host "  >> Tracking Token: $trackToken" -ForegroundColor DarkGray
    $pubTrack = Test-API "GET" "/rides/track/$trackToken" $null $null "Public Track (NO auth!)"
    if ($pubTrack -and $pubTrack.ride) {
        Write-Host "  >> Route: $($pubTrack.ride.source) -> $($pubTrack.ride.destination)" -ForegroundColor DarkGray
        Write-Host "  >> Owner: $($pubTrack.ride.owner_username)" -ForegroundColor DarkGray
        Write-Host "  >> Vehicle: $($pubTrack.ride.vehicle_reg)" -ForegroundColor DarkGray
    }
} else {
    Write-Host "  SKIP: No tracking_token" -ForegroundColor Yellow
    $script:SKIP_COUNT++
}

# ============================================================
# 13. CHAT MESSAGES
# ============================================================
Write-Host "`n[SECTION 13] CHAT MESSAGES" -ForegroundColor Yellow
Test-API "GET" "/rides/$rideId/messages" $null $tokenA "Get Chat Messages (Owner A)"
Test-API "GET" "/rides/$rideId/messages" $null $tokenB "Get Chat Messages (Member B)"

# ============================================================
# 14. SOS EMERGENCY DATA
# ============================================================
Write-Host "`n[SECTION 14] SOS EMERGENCY DATA" -ForegroundColor Yellow
$sosA = Test-API "GET" "/rides/$rideId/sos-data" $null $tokenA "SOS Data (Owner A)"
if ($sosA) {
    Write-Host "  >> Emergency: $($sosA.emergencyContact.name) - $($sosA.emergencyContact.phone)" -ForegroundColor DarkGray
    Write-Host "  >> Vehicle: $($sosA.vehicleReg)" -ForegroundColor DarkGray
    Write-Host "  >> Route: $($sosA.source) -> $($sosA.destination)" -ForegroundColor DarkGray
}

$sosB = Test-API "GET" "/rides/$rideId/sos-data" $null $tokenB "SOS Data (Joiner B)"
if ($sosB) {
    Write-Host "  >> CoPassengers: $($sosB.coPassengers -join ', ')" -ForegroundColor DarkGray
}

# ============================================================
# 15. TRIP COMPLETION
# ============================================================
Write-Host "`n[SECTION 15] TRIP COMPLETION" -ForegroundColor Yellow
Test-API "POST" "/rides/$rideId/complete-trip" $null $tokenA "Complete Trip"
$rideAfterComplete = Test-API "GET" "/rides/$rideId/detail" $null $tokenA "Verify trip_completed=true"
if ($rideAfterComplete -and $rideAfterComplete.ride.trip_completed) {
    Write-Host "  >> Trip is COMPLETED" -ForegroundColor Green
}

# ============================================================
# 16. RATING SYSTEM
# ============================================================
Write-Host "`n[SECTION 16] RATING SYSTEM" -ForegroundColor Yellow
Test-API "GET" "/rides/$rideId/check-ratings" $null $tokenA "Check unrated users (A)"

$membersForRating = Test-API "GET" "/rides/$rideId/members" $null $tokenA "Get Members for Rating"
if ($membersForRating -and $membersForRating.members) {
    $userBMember = $membersForRating.members | Where-Object { $_.username -eq "TestJoinerY" }
    $userAMember = $membersForRating.members | Where-Object { $_.username -eq "TestOwnerX" }

    if ($userBMember) {
        Test-API "POST" "/rides/$rideId/rate" @{
            ratings = @(@{ userId = [int]$userBMember.id; stars = 5 })
        } $tokenA "A rates B: 5 stars"
    }
    if ($userAMember) {
        Test-API "POST" "/rides/$rideId/rate" @{
            ratings = @(@{ userId = [int]$userAMember.id; stars = 4 })
        } $tokenB "B rates A: 4 stars"
    }
}

$profileAfterRating = Test-API "GET" "/auth/me" $null $tokenA "Profile A after rating"
if ($profileAfterRating -and $profileAfterRating.user) {
    Write-Host "  >> Trip count: $($profileAfterRating.user.trip_count)" -ForegroundColor DarkGray
}

# ============================================================
# 17. EMERGENCY CONTACT UPDATE
# ============================================================
Write-Host "`n[SECTION 17] EMERGENCY CONTACT UPDATE" -ForegroundColor Yellow
# Correct endpoint: /api/auth/update-emergency-contact with name+phone
Test-API "POST" "/auth/update-emergency-contact" @{
    name = "Updated Mom"
    phone = "9333333333"
} $tokenA "Update Emergency Contact"

$profileUpdated = Test-API "GET" "/auth/me" $null $tokenA "Verify Updated Contact"
if ($profileUpdated -and $profileUpdated.user.emergency_contact_name -eq "Updated Mom") {
    Write-Host "  >> Emergency contact updated OK!" -ForegroundColor Green
} else {
    Write-Host "  >> Emergency contact NOT updated!" -ForegroundColor Red
}

# ============================================================
# 18. PINK MODE
# ============================================================
Write-Host "`n[SECTION 18] PINK MODE" -ForegroundColor Yellow
$pinkRide = Test-API "POST" "/rides/register" @{
    source = "Kukatpally"
    destination = "Gachibowli"
    date = $rideDate
    rideTime = "14:00"
    vehicleType = "Auto"
    seatsAvailable = 3
    maleCount = 0
    femaleCount = 1
    pinkMode = $true
} $tokenB "Female B registers Pink Mode Ride"

# Male user searches WITHOUT pinkMode flag - should NOT see pink rides
$normalSearch = Test-API "POST" "/rides/search" @{
    source = "Kukatpally"
    destination = "Gachibowli"
    date = $rideDate
} $tokenA "Male A normal search (pink rides hidden)"

$pinkRidesVisible = 0
if ($normalSearch -and $normalSearch.rides) {
    $pinkRidesInResult = $normalSearch.rides | Where-Object { $_.pink_mode -eq 1 }
    $pinkRidesVisible = @($pinkRidesInResult).Count
}

if ($pinkRidesVisible -eq 0) {
    Write-Host "  >> Pink Mode filtering OK: Male sees 0 pink rides" -ForegroundColor Green
} else {
    Write-Host "  >> PROBLEM: Male sees $pinkRidesVisible pink ride(s)!" -ForegroundColor Red
}

# Female searches - SHOULD see pink rides
$femaleSearch = Test-API "POST" "/rides/search" @{
    source = "Kukatpally"
    destination = "Gachibowli"
    date = $rideDate
} $tokenB "Female B search (should see pink rides)"

# Note: B owns the pink ride, so it won't appear (user_id != filter)
# This is expected behavior - can't search your own rides

# ============================================================
# FINAL SUMMARY
# ============================================================
Write-Host ""
Write-Host "================================================" -ForegroundColor Magenta
Write-Host "   TEST SUITE COMPLETE" -ForegroundColor Magenta
Write-Host "================================================" -ForegroundColor Magenta
Write-Host "  PASSED : $PASS_COUNT" -ForegroundColor Green
Write-Host "  FAILED : $FAIL_COUNT" -ForegroundColor Red
Write-Host "  SKIPPED: $SKIP_COUNT" -ForegroundColor Yellow
Write-Host "================================================" -ForegroundColor Magenta
