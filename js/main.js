// declaring global variables
var map;
var infoWindow;
var bounds;

// Initialize Google Maps
function initMap() {
    // console.log ('Inside initMap');
    // Create a new blank array for all the listing markers.
    var markers = [];
    // Location
    var santaCruz = {
        lat: 36.9741171,
        lng: -122.0329903
    };

    // The map, centered at the given location
    map = new google.maps.Map(document.getElementById('map'), {
        center: santaCruz,
        zoom: 8
    });

    bounds = new google.maps.LatLngBounds();
    ko.applyBindings(new ViewModel());
}

// Location Model
var LocationMarker = function(data) {
    // console.log ('Inside Location Marker');
    var self = this;

    this.title = data.title;
    this.position = data.location;
    this.street = '';
    this.city = '';
    this.phone = '';

    this.visible = ko.observable(true);

    // Foursquare credentials
    var clientID = 'GLEGEPXOLZQL4ZAD0TWQ1XNN1C3CHCA0AVU4S5FGAUFXTFDE';
    var clientSecret = 'JGSVBXO4YCAVNK5W23RR4UD4MMU0YAKCHMIEM4VUBQW0ARDE';

    // Style the markers a bit. This will be our listing marker icon.
    var defaultIcon = makeMarkerIcon('0091ff');
    // Create a "highlighted location" marker color for when the user
    // mouses over the marker.
    var highlightedIcon = makeMarkerIcon('FFFF24');

    // get JSON request of foursquare data
    var reqURL = 'https://api.foursquare.com/v2/venues/search?ll=' +
        this.position.lat + ',' + this.position.lng + '&client_id=' +
        clientID + '&client_secret=' + clientSecret + '&v=20160118' +
        '&query=' + this.title;
    // console.log(reqURL);
    $.getJSON(reqURL).done(function(data) {
        var results = data.response.venues[0];
        self.street = results.location.formattedAddress[0] ? results.location.formattedAddress[0] : 'N/A';
        self.city = results.location.formattedAddress[1] ? results.location.formattedAddress[1] : 'N/A';
        self.phone = results.contact.formattedPhone ? results.contact.formattedPhone : 'N/A';
        // console.log(self.street);
    }).fail(function() {
        alert('Something went wrong with foursquare');
    });

    // Initialize info window
    var infowindow = new google.maps.InfoWindow();

    // Create a marker per location, and put into markers array.
    var marker = new google.maps.Marker({
        position: this.position,
        map: map,
        title: this.title,
        draggable: true,
        animation: google.maps.Animation.DROP,
    });

    self.filterMarkers = ko.computed(function() {
        // set marker and extend bounds (showListings)
        if (self.visible() === true) {
            // console.log (marker);
            marker.setMap(map);
            bounds.extend(marker.position);
            map.fitBounds(bounds);
        } else {
            marker.setMap(null);
        }
    });

    // Create an onclick even to open an indowindow at each marker
    marker.addListener('click', function() {
        populateInfoWindow(this, infowindow, self.street,
            self.city, self.phone);
        toggleBounce(this);
        map.panTo(this.getPosition());
    });

    // Two event listeners - one for mouseover, one for mouseout,
    // to change the colors back and forth.
    marker.addListener('mouseover', function() {
        this.setIcon(highlightedIcon);
    });
    marker.addListener('mouseout', function() {
        this.setIcon(defaultIcon);
    });

    // show item info when selected from list
    this.show = function(location) {
        google.maps.event.trigger(marker, 'click');
    };

}

/* View Model */
var ViewModel = function() {
    // console.log ('Inside view model');
    var self = this;

    this.searchItem = ko.observable('');

    this.mapList = ko.observableArray([]);

    // add location markers for each location
    locations.forEach(function(location) {
        self.mapList.push(new LocationMarker(location));
    });

    // locations viewed on map
    this.locationList = ko.computed(function() {
        var searchFilter = self.searchItem().toLowerCase();
        if (searchFilter) {
            return ko.utils.arrayFilter(self.mapList(), function(location) {
                var str = location.title.toLowerCase();
                var result = str.includes(searchFilter);
                location.visible(result);
                return result;
            });
        }
        self.mapList().forEach(function(location) {
            location.visible(true);
        });
        return self.mapList();
    }, self);
};

function populateInfoWindow(marker, infowindow, street, city, phone) {
    // Check to make sure the infowindow is not already opened on this marker.
    if (infowindow.marker != marker) {
        // Clear the infowindow content to give the streetview time to load.
        infowindow.setContent('');
        infowindow.marker = marker;
        // Make sure the marker property is cleared if the infowindow is closed
        infowindow.addListener('closeclick', function() {
            infowindow.marker = null;
        });

        var streetViewService = new google.maps.StreetViewService();
        var radius = 50;

        // Content from Foursquare to be displayed on infowindow
        var windowContent = '<h4>' + marker.title + '</h4>' +
            '<p>' + street + "<br>" + city + '<br>' + phone + "</p>"

        // In case the status is OK, which means the pano was found, compute
        // the position of the streetview image, then calculate the heading,
        // then get a panorama from that and set the options
        function getStreetView(data, status) {
            if (status == google.maps.StreetViewStatus.OK) {
                var nearStreetViewLocation = data.location.latLng;
                var heading = google.maps.geometry.spherical.computeHeading(
                    nearStreetViewLocation, marker.position);
                infowindow.setContent(windowContent + '<div id="pano"></div>');
                var panoramaOptions = {
                    position: nearStreetViewLocation,
                    pov: {
                        heading: heading,
                        pitch: 30
                    }
                };
                var panorama = new google.maps.StreetViewPanorama(
                    document.getElementById('pano'), panoramaOptions);
            } else {
                infowindow.setContent('<div>' + marker.title + '</div>' +
                    '<div>No Street View Found</div>');
            }
        };
        // Use streetview service to get the closest streetview image within
        // 50 meters of the markers position
        streetViewService.getPanoramaByLocation(marker.position,
            radius, getStreetView);
        // Open the infowindow on the correct marker.
        infowindow.open(map, marker);
    }
}

function toggleBounce(marker) {
    if (marker.getAnimation() !== null) {
        marker.setAnimation(null);
    } else {
        marker.setAnimation(google.maps.Animation.BOUNCE);
        setTimeout(function() {
            marker.setAnimation(null);
        }, 1400);
    }
}

// This function takes in a COLOR, and then creates a new marker
// icon of that color. The icon will be 21 px wide by 34 high, have an origin
// of 0, 0 and be anchored at 10, 34).
function makeMarkerIcon(markerColor) {
    var markerImage = new google.maps.MarkerImage(
        'http://chart.googleapis.com/chart?chst=d_map_spin&chld=1.15|0|' + markerColor +
        '|40|_|%E2%80%A2',
        new google.maps.Size(21, 34),
        new google.maps.Point(0, 0),
        new google.maps.Point(10, 34),
        new google.maps.Size(21, 34));
    return markerImage;
}