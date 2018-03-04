import { geolocation } from "geolocation";
import * as messaging from "messaging";

var index = 1;

console.log("App started");

var GPSoptions = {
  enableHighAccuracy: false,
  maximumAge: 60000
};

function locationError(error) {
  console.log("Error fetching location");
  sendResponse({error:true,message:"no_location"});
}

function getStations(position) {
  var latitude, longitude;
  
  latitude = position.coords.latitude;
  longitude = position.coords.longitude;
  
  console.log("Location: "+latitude+", "+longitude);
  var url = "https://www3.vvs.de/mngvvs/XML_STOPFINDER_REQUEST?SpEncId=0&coordOutputFormat=EPSG:4326&name_sf=coord:"+longitude+":"+latitude+":WGS84%5Bdd.ddddd%5D&outputFormat=rapidJSON&serverInfo=1&suggestApp=vvs&type_sf=any&version=10.2.2.48";
  //console.log("Loading data from "+url);
  fetch(url).then(function (response) {
      response.text()
      .then(function(data) {
        var data = JSON.parse(data);
        var searched_index = 0;
        for(var i = 0;i<data["locations"][0]["assignedStops"].length;i++){
          if(data["locations"][0]["assignedStops"][i]["id"]!=undefined){
             searched_index++;
          }
          if(data["locations"][0]["assignedStops"][i]["id"]!=undefined && searched_index >= index){
            var url2 = "https://www3.vvs.de/mngvvs/XML_DM_REQUEST?SpEncId=0&coordOutputFormat=EPSG:4326&deleteAssignedStops=1&limit=4&mode=direct&name_dm="+data["locations"][0]["assignedStops"][i]["id"]+"&outputFormat=rapidJSON&serverInfo=1&type_dm=any&useRealtime=1&version=10.2.2.48";
            //console.log(url2);
            fetch(url2)
            .then(function (response2) {
                response2.text()
                .then(function(data2) {
                  //console.log("Hallo:"+data2);
                  var data2 = JSON.parse(data2);
                  var data_response = {
                    name: data2["locations"][0]["disassembledName"],
                    to:[],
                    departures:[],
                    number:[],
                    operators:[],
                    platforms:[],
                    categories:[]
                  }
                  
                  try{
                    for(var ia=0;ia<data2["stopEvents"].length;ia++){
                      try{
                        //console.log(ia+": "+data2["stationboard"][ia]["to"]);
                        data_response.to[ia] = data2["stopEvents"][ia]["transportation"]["destination"]["name"];
                        data_response.departures[ia] = Date.parse(data2["stopEvents"][ia]["departureTimeEstimated"])/1000;
                        data_response.number[ia] = data2["stopEvents"][ia]["transportation"]["number"];
                        data_response.operators[ia] = data2["stopEvents"][ia]["transportation"]["operator"]["name"];
                        data_response.platforms[ia] = "";
                        data_response.categories[ia] = "";
                      }catch(e){
                        break;
                      }
                    }
                  }catch(e){
                    
                  }

                  sendResponse(data_response);
                });
            }).catch(function (err) {
              console.log("Error fetching data from internet: " + err);
            });
            break;
          }
        }
      });
  })
  .catch(function (err) {
    console.log("Error fetching: " + err);
  });
}

function sendResponse(response){
  if (messaging.peerSocket.readyState === messaging.peerSocket.OPEN) {
    // Send a command to the device
    console.log("Sending response");
    messaging.peerSocket.send(response);
  } else {
    console.log("Error: Connection is not open");
  }
}

messaging.peerSocket.onopen = function() {
  console.log("Socket open");
  geolocation.getCurrentPosition(getStations, locationError, GPSoptions);
}

// Listen for messages from the device
messaging.peerSocket.onmessage = function(evt) {
  if(evt.data.key=="changeStationDown"){
    index++;
    geolocation.getCurrentPosition(getStations, locationError, GPSoptions);
  }else if(evt.data.key=="changeStationUp"){
    index--;
    geolocation.getCurrentPosition(getStations, locationError, GPSoptions);
  }
}

// Listen for the onerror event
messaging.peerSocket.onerror = function(err) {
  // Handle any errors
  console.log("Connection error: " + err.code + " - " + err.message);
}