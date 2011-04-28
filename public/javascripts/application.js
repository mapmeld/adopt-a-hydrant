$(function() {
  var activeHydrantId;
  var activeMarker;
  var activeInfoWindow;
  var isWindowOpen = false;
  var hydrantIds = [];
  /* declare OpenLayers variables that need scope throughout this file */
  var map, hydrantLayer, hydrantIconStyle, selectControl;
  /* load OpenLayers script, then run new function initMap() */
  if(!OpenLayers) {
    var OpenLayersScript = document.createElement("script");
    OpenLayersScript.type = "text/javascript";
    OpenLayersScript.src = "http://openlayers.org/api/OpenLayers.js";
    OpenLayersScript.onload = function() { initMap() };
    document.body.appendChild(OpenLayersScript);
  }
  else {
    initMap();
  }
  function initMap() {
    /* create an OpenLayers map on map_canvas which supports standard and Google Maps projections */
    map = new OpenLayers.Map({
      div: "map_canvas",
      projection: new OpenLayers.Projection('EPSG:900913'),
      'displayProjection': new OpenLayers.Projection('EPSG:4326')
    });
    /* add OpenStreetMap layer */
    var osm = new OpenLayers.Layer.OSM();
    map.addLayer(osm);
    /* set center and zoom ( using OpenLayers's LonLat order ) */
    var center = new OpenLayers.LonLat( -71.059773, 42.358431 ).transform(map.displayProjection, map.projection);
    var zoomLevel = 15;
    map.setCenter(center, zoomLevel);
    /* create and add a layer for hydrant points */
    var layerStyle = OpenLayers.Util.extend({}, OpenLayers.Feature.Vector.style['default']);
    hydrantLayer = new OpenLayers.Layer.Vector("Hydrants", {style: layerStyle});
    map.addLayer(hydrantLayer);
    /* create standard hydrant icon style */
    hydrantIconStyle = OpenLayers.Util.extend({}, layerStyle);
    hydrantIconStyle.graphicWidth = 27;
    hydrantIconStyle.graphicHeight = 37;
    hydrantIconStyle.fillOpacity = 1;
    hydrantIconStyle.graphicOpacity = 1;
    hydrantIconStyle.backgroundGraphic = "/shadow.png";
    hydrantIconStyle.backgroundXOffset = -8;
    hydrantIconStyle.backgroundYOffset = -19;
    hydrantIconStyle.graphicZIndex = 11;
    hydrantIconStyle.backgroundGraphicZIndex = 10;
    /* monitor click events on the hydrant layer */
    selectControl = new OpenLayers.Control.SelectFeature( hydrantLayer );
    map.addControl(selectControl);
    selectControl.activate();
    /* connect click events to functions onFeatureSelect and onFeatureUnselect */
    hydrantLayer.events.on({
      'featureselected': onFeatureSelect,
      'featureunselected': onFeatureUnselect
    });
    /* add dragend / moveend event to the OpenLayers map */
    map.events.register( "moveend", map, function() {
      if(isWindowOpen == true) {
        return;
      }
      var center = map.getCenter().transform(map.projection, map.displayProjection);
      addMarkersAround(center.lat, center.lon);
    });
  }
  function onFeatureSelect(clickInfo) {
    clickedFeature = clickInfo.feature;
    hydrantId =  clickedFeature.attributes.hydrantId;
    activeHydrantId = hydrantId;
    activeMarker = clickedFeature;
    $.ajax({
      type: 'GET',
      url: '/hydrant',
      data: {
        'hydrant_id': hydrantId
      },
      success: function(data) {
        /* activeInfoWindow opening and closing code based on OpenLayers.org/dev/examples/ and Ushahidi.com */
        activeInfoWindow = new OpenLayers.Popup.FramedCloud(
          "featurePopup",
          clickedFeature.geometry.getBounds().getCenterLonLat(),
          new OpenLayers.Size(200,350),
          data,
          null,
          true,
          onPopupClose
        );
        clickedFeature.popup = activeInfoWindow;
        activeInfoWindow.feature = clickedFeature;
        map.addPopup(activeInfoWindow);
        isWindowOpen = true;
      }
    });
  }
  function onFeatureUnselect(clickInfo) {
    feature = clickInfo.feature;
    if (feature.popup) {
      activeInfoWindow.feature = null;
      map.removePopup(feature.popup);
      feature.popup.destroy();
      feature.popup = null;
      isWindowOpen = false;
    }
  }
  function onPopupClose(closeInfo) {
    selectControl.unselect(this.feature);
    isWindowOpen = false;
  }
  function addMarker(hydrantId, point, color) {
    var imageStyle = OpenLayers.Util.extend({}, hydrantIconStyle);
    imageStyle.externalGraphic = color;
    /* drop animation not directly supported in OpenLayers */
    /*animation: google.maps.Animation.DROP,*/
    var marker = new OpenLayers.Feature.Vector( point, null, imageStyle );
    /* set up info before adding hydrant to the map */
    marker.attributes = {
      hydrantId: hydrantId
    };
    hydrantLayer.addFeatures( [ marker ] );
    hydrantIds.push(hydrantId);
  }
  function addMarkersAround(lat, lng) {
    $.ajax({
      type: 'GET',
      url: '/hydrants.json',
      data: {
        'commit': $('#address_form input[type="submit"]').val(),
        'utf8': '?',
        'authenticity_token': $('#address_form input[name="authenticity_token"]').val(),
        'lat': lat,
        'lng': lng
      },
      success: function(data) {
        if(data.errors) {
          $('#address_label').addClass('error', 500);
          $('#address').addClass('error', 500);
          $('#address').focus();
        } else {
          $('#address_label').removeClass('error', 500);
          $('#address').removeClass('error', 500);
          var i = -1;
          $(data).each(function(index, hydrant) {
            hydrant = hydrant.hydrant;
            if($.inArray(hydrant.id, hydrantIds) == -1) {
              i += 1;
            } else {
              // continue
              return true;
            }
            setTimeout(function() {
              point = new OpenLayers.Geometry.Point(hydrant.lng, hydrant.lat).transform( map.displayProjection, map.projection);
              color = '/' + (hydrant.user_id ? 'green' : 'red') + '.png';
              addMarker(hydrant.id, point, color);
            }, i * 100);
          });
          //center = new OpenLayers.LonLat(lng , lat).transform(map.displayProjection, map.projection);
          //map.setCenter(center, 18);
        }
      }
    });
  }
  $('#address_form').submit(function() {
    var submitButton = $("#address_form input[type='submit']");
    $(submitButton).attr("disabled", true);
    var submitButtonText = $(submitButton).attr("value");
    $(submitButton).attr("value", "Please Wait...");
    if($('#address').val() === '') {
      $(submitButton).attr("disabled", false);
      $(submitButton).attr("value", submitButtonText);
      $('#address_label').addClass('error', 500);
      $('#address').addClass('error', 500);
      $('#address').focus();
    } else {
      $.ajax({
        type: 'GET',
        url: '/address.json',
        data: {
          'commit': submitButton.val(),
          'utf8': '?',
          'authenticity_token': $('#address_form input[name="authenticity_token"]').val(),
          'city_state': $('#city_state').val(),
          'address': $('#address').val()
        },
        success: function(data) {
          $(submitButton).attr("disabled", false);
          $(submitButton).attr("value", submitButtonText);
          if(data.errors) {
            $('#address_label').addClass('error', 500);
            $('#address').addClass('error', 500);
            $('#address').focus();
          } else {
            addMarkersAround(data[0], data[1]);
          }
        }
      });
    }
    return false;
  });
  $('#combo_form input[type="radio"]').live('click', function() {
    var self = $(this);
    if('new' == self.val()) {
      $('#user_forgot_password_fields').slideUp();
      $('#user_sign_in_fields').slideUp();
      $('#user_sign_up_fields').slideDown();
      $('#combo_form').data('state', 'user_sign_up');
    } else if('existing' == self.val()) {
      $('#user_sign_up_fields').slideUp();
      $('#user_sign_in_fields').slideDown(function() {
      $('#combo_form').data('state', 'user_sign_in');
        $('#user_forgot_password_link').click(function() {
          $('#user_sign_in_fields').slideUp();
          $('#user_forgot_password_fields').slideDown(function() {
            $('#user_remembered_password').click(function() {
              $('#user_forgot_password_fields').slideUp();
              $('#user_sign_in_fields').slideDown();
              $('#combo_form').data('state', 'user_sign_in');
            });
          });
          $('#combo_form').data('state', 'user_forgot_password');
        });
      });
    }
  });
  $('#combo_form').live('submit', function() {
    var submitButton = $("#combo_form input[type='submit']");
    $(submitButton).attr("disabled", true);
    var errors = []
    if(!/[\w\.%\+\]+@[\w\]+\.+[\w]{2,}/.test($('#user_email').val())) {
      errors.push($('#user_email'));
      $('#user_email_label').addClass('error', 500);
      $('#user_email').addClass('error', 500);
    } else {
      $('#user_email_label').removeClass('error');
      $('#user_email').removeClass('error');
    }
    if(!$(this).data('state') || $(this).data('state') === 'user_sign_up') {
      if($('#user_name').val() === '') {
        errors.push($('#user_name'));
        $('#user_name_label').addClass('error', 500);
        $('#user_name').addClass('error', 500);
      } else {
        $('#user_name_label').removeClass('error');
        $('#user_name').removeClass('error');
      }
      if($('#user_password_confirmation').val().length < 6 || $('#user_password_confirmation').val().length > 20) {
        errors.push($('#user_password_confirmation'));
        $('#user_password_confirmation_label').addClass('error', 500);
        $('#user_password_confirmation').addClass('error', 500);
      } else {
        $('#user_password_confirmation_label').removeClass('error');
        $('#user_password_confirmation').removeClass('error');
      }
      if(errors.length > 0) {
        $(submitButton).attr("disabled", false);
        errors[0].focus();
      } else {
        $.ajax({
          type: 'POST',
          url: '/users.json',
          data: {
            'commit': submitButton.val(),
            'utf8': '?',
            'authenticity_token': $('#combo_form input[name="authenticity_token"]').val(),
            'user': {
              'email': $('#user_email').val(),
              'name': $('#user_name').val(),
              'organization': $('#user_organization').val(),
              'voice_number': $('#user_voice_number').val(),
              'sms_number': $('#user_sms_number').val(),
              'password': $('#user_password_confirmation').val(),
              'password_confirmation': $('#user_password_confirmation').val()
            }
          },
          beforeSend: function() {
            $('#info_window').hide();
            $('#loader').show();
          },
          error: function(data) {
            console.log(data);
            $('#loader').hide();
            $('#info_window').show();
            $(submitButton).attr("disabled", false);
          },
          success: function(data) {
            if(data.errors) {
              $('#loader').hide();
              $('#info_window').show();
              $(submitButton).attr("disabled", false);
              if(data.errors.email) {
                errors.push($('#user_email'));
                $('#user_email_label').addClass('error', 500);
                $('#user_email').addClass('error', 500);
              }
              if(data.errors.name) {
                errors.push($('#user_name'));
                $('#user_name_label').addClass('error', 500);
                $('#user_name').addClass('error', 500);
              }
              if(data.errors.organization) {
                errors.push($('#user_organization'));
                $('#user_organization_label').addClass('error', 500);
                $('#user_organization').addClass('error', 500);
              }
              if(data.errors.voice_number) {
                errors.push($('#user_voice_number'));
                $('#user_voice_number_label').addClass('error', 500);
                $('#user_voice_number').addClass('error', 500);
              }
              if(data.errors.sms_number) {
                errors.push($('#user_sms_number'));
                $('#user_sms_number_label').addClass('error', 500);
                $('#user_sms_number').addClass('error', 500);
              }
              if(data.errors.password) {
                errors.push($('#user_password_confirmation'));
                $('#user_password_confirmation_label').addClass('error', 500);
                $('#user_password_confirmation').addClass('error', 500);
              }
              errors[0].focus();
            } else {
              $.ajax({
                type: 'GET',
                url: '/hydrant',
                data: {
                  'hydrant_id': activeHydrantId
                },
                success: function(data) {
                  activeInfoWindow.setContentHTML(data);
                }
              });
            }
          }
        });
      }
    } else if($(this).data('state') === 'user_sign_in') {
      if($('#user_password').val().length < 6 || $('#user_password').val().length > 20) {
        errors.push($('#user_password'));
        $('#user_password_label').addClass('error', 500);
        $('#user_password').addClass('error', 500);
      } else {
        $('#user_password_label').removeClass('error');
        $('#user_password').removeClass('error');
      }
      if(errors.length > 0) {
        $(submitButton).attr("disabled", false);
        errors[0].focus();
      } else {
        $.ajax({
          type: 'POST',
          url: '/users/sign_in.json',
          data: {
            'commit': submitButton.val(),
            'utf8': '?',
            'authenticity_token': $('#combo_form input[name="authenticity_token"]').val(),
            'user': {
              'email': $('#user_email').val(),
              'password': $('#user_password').val(),
              'remember_me': $('#user_remember_me').val()
            }
          },
          beforeSend: function() {
            $('#info_window').hide();
            $('#loader').show();
          },
          error: function(data) {
            console.log(data);
            $('#loader').hide();
            $('#info_window').show();
            $(submitButton).attr("disabled", false);
          },
          success: function(data) {
            if(data.errors) {
              $('#loader').hide();
              $('#info_window').show();
              $(submitButton).attr("disabled", false);
              $('#user_password_label').addClass('error', 500);
              $('#user_password').addClass('error', 500);
              $('#user_password').focus();
            } else {
              $.ajax({
                type: 'GET',
                url: '/hydrant',
                data: {
                  'hydrant_id': activeHydrantId
                },
                success: function(data) {
                  activeInfoWindow.setContentHTML(data);
                }
              });
            }
          }
        });
      }
    } else if($(this).data('state') === 'user_forgot_password') {
      if(errors.length > 0) {
        $(submitButton).attr("disabled", false);
        errors[0].focus();
      } else {
        $.ajax({
          type: 'POST',
          url: '/users/password.json',
          data: {
            'commit': submitButton.val(),
            'utf8': '?',
            'authenticity_token': $('#combo_form input[name="authenticity_token"]').val(),
            'user': {
              'email': $('#user_email').val()
            }
          },
          beforeSend: function() {
            $('#info_window').hide();
            $('#loader').show();
          },
          error: function(data) {
            console.log(data);
            $('#loader').hide();
            $('#info_window').show();
            $(submitButton).attr("disabled", false);
          },
          success: function() {
            if(data.errors) {
              $('#loader').hide();
              $('#info_window').show();
              $(submitButton).attr("disabled", false);
              $('#user_email_label').addClass('error', 500);
              $('#user_email').addClass('error', 500);
              $('#user_email').focus();
            } else {
              $('#user_forgot_password_fields').slideUp();
              $('#user_sign_in_fields').slideDown();
            }
          }
        });
      }
    }
    return false;
  });
  $('#adoption_form').live('submit', function() {
    var submitButton = $("#adoption_form input[type='submit']");
    $(submitButton).attr("disabled", true);
    $.ajax({
      type: 'POST',
      url: '/hydrants.json',
      data: {
        'id': $('#hydrant_id').val(),
        'commit': submitButton.val(),
        'utf8': '?',
        'authenticity_token': $('#adoption_form input[name="authenticity_token"]').val(),
        '_method': 'put',
        'hydrant': {
          'user_id': $('#hydrant_user_id').val(),
          'name': $('#hydrant_name').val()
        }
      },
      beforeSend: function() {
        $('#info_window').hide();
        $('#loader').show();
      },
      error: function(data) {
        console.log(data);
        $('#loader').hide();
        $('#info_window').show();
        $(submitButton).attr("disabled", false);
      },
      success: function(data) {
        $.ajax({
          type: 'GET',
          url: '/hydrant',
          data: {
            'hydrant_id': activeHydrantId
          },
          success: function(data) {
            activeInfoWindow.setContentHTML(data);
            //activeInfoWindow.setContentHTML(data);
            activeMarker.style.externalGraphic = '/green.png';
            /* bounce animation not directly supported by OpenLayers */
            /* activeMarker.setAnimation(google.maps.Animation.BOUNCE); */
          }
        });
      }
    });
    return false;
  });
  $('#abandon_form').live('submit', function() {
    var answer = window.confirm("Are you sure you want to abandon this hydrant?")
    if(answer) {
      var submitButton = $("#abandon_form input[type='submit']");
      $(submitButton).attr("disabled", true);
      $.ajax({
        type: 'POST',
        url: '/hydrant',
        data: {
          'id': $('#hydrant_id').val(),
          'commit': submitButton.val(),
          'utf8': '?',
          'authenticity_token': $('#abandon_form input[name="authenticity_token"]').val(),
          '_method': 'put',
          'hydrant': {
            'user_id': $('#hydrant_user_id').val(),
            'name': $('#hydrant_name').val()
          }
        },
        beforeSend: function() {
          $('#info_window').hide();
          $('#loader').show();
        },
        error: function(data) {
          console.log(data);
          $('#loader').hide();
          $('#info_window').show();
          $(submitButton).attr("disabled", false);
        },
        success: function(data) {
          $.ajax({
            type: 'GET',
            url: '/hydrant',
            data: {
              'hydrant_id': activeHydrantId
            },
            success: function(data) {
              activeInfoWindow.setContentHTML(data);
              activeMarker.style.externalGraphic = '/red.png';
              /* animation not supported by OpenLayers */
              /*activeMarker.setAnimation(null);*/
            }
          });
        }
      });
    }
    return false;
  });
  $('#steal_form').live('submit', function() {
    var answer = window.confirm("Are you sure you want to steal this hydrant?")
    if(answer) {
      var submitButton = $("#steal_form input[type='submit']");
      $(submitButton).attr("disabled", true);
      $.ajax({
        type: 'POST',
        url: '/hydrant',
        data: {
          'id': $('#hydrant_id').val(),
          'commit': submitButton.val(),
          'utf8': '?',
          'authenticity_token': $('#steal_form input[name="authenticity_token"]').val(),
          '_method': 'put',
          'hydrant': {
            'user_id': $('#hydrant_user_id').val(),
            'name': $('#hydrant_name').val()
          }
        },
        beforeSend: function() {
          $('#info_window').hide();
          $('#loader').show();
        },
        error: function(data) {
          console.log(data);
          $('#loader').hide();
          $('#info_window').show();
          $(submitButton).attr("disabled", false);
        },
        success: function(data) {
          $.ajax({
            type: 'GET',
            url: '/hydrant',
            data: {
              'hydrant_id': activeHydrantId
            },
            success: function(data) {
              activeInfoWindow.setContentHTML(data);
              activeMarker.style.externalGraphic = '/red.png';
              /* animations not directly supported by OpenLayers */
              /*activeMarker.setAnimation(null);*/
            }
          });
        }
      });
    }
    return false;
  });
  $('#edit_profile_form').live('submit', function() {
    var submitButton = $("#edit_profile_form input[type='submit']");
    $(submitButton).attr("disabled", true);
    $.ajax({
      type: 'GET',
      url: '/users/edit',
      data: {
        'commit': submitButton.val(),
        'utf8': '?',
        'authenticity_token': $('#edit_profile_form input[name="authenticity_token"]').val()
      },
      beforeSend: function() {
        $('#info_window').hide();
        $('#loader').show();
      },
      error: function(data) {
        console.log(data);
        $('#loader').hide();
        $('#info_window').show();
        $(submitButton).attr("disabled", false);
      },
      success: function(data) {
        activeInfoWindow.setContentHTML(data);
      }
    });
    return false;
  });
  $('#edit_form').live('submit', function() {
    var submitButton = $("#edit_form input[type='submit']");
    $(submitButton).attr("disabled", true);
    var errors = []
    if(!/[\w\.%\+\]+@[\w\]+\.+[\w]{2,}/.test($('#user_email').val())) {
      errors.push($('#user_email'));
      $('#user_email_label').addClass('error', 500);
      $('#user_email').addClass('error', 500);
    } else {
      $('#user_email_label').removeClass('error');
      $('#user_email').removeClass('error');
    }
    if($('#user_name').val() === '') {
      errors.push($('#user_name'));
      $('#user_name_label').addClass('error', 500);
      $('#user_name').addClass('error', 500);
    } else {
      $('#user_name_label').removeClass('error');
      $('#user_name').removeClass('error');
    }
    if($('#user_password').val() && ($('#user_password').val().length < 6 || $('#user_password').val().length > 20)) {
      errors.push($('#user_password'));
      $('#user_password_label').addClass('error', 500);
      $('#user_password').addClass('error', 500);
    } else {
      $('#user_password_label').removeClass('error');
      $('#user_password').removeClass('error');
    }
    if($('#user_current_password').val().length < 6 || $('#user_current_password').val().length > 20) {
      errors.push($('#user_current_password'));
      $('#user_current_password_label').addClass('error', 500);
      $('#user_current_password').addClass('error', 500);
    } else {
      $('#user_current_password_label').removeClass('error');
      $('#user_current_password').removeClass('error');
    }
    if(errors.length > 0) {
      $(submitButton).attr("disabled", false);
      errors[0].focus();
    } else {
      $.ajax({
        type: 'POST',
        url: '/users.json',
        data: {
          'id': $('#id').val(),
          'hydrant_id': activeHydrantId,
          'commit': submitButton.val(),
          'utf8': '?',
          'authenticity_token': $('#edit_form input[name="authenticity_token"]').val(),
          '_method': 'put',
          'user': {
            'email': $('#user_email').val(),
            'name': $('#user_name').val(),
            'organization': $('#user_organization').val(),
            'voice_number': $('#user_voice_number').val(),
            'sms_number': $('#user_sms_number').val(),
            'password': $('#user_password').val(),
            'password_confirmation': $('#user_password').val(),
            'current_password': $('#user_current_password').val()
          }
        },
        beforeSend: function() {
          $('#info_window').hide();
          $('#loader').show();
        },
        error: function(data) {
          console.log(data);
          $('#loader').hide();
          $('#info_window').show();
          $(submitButton).attr("disabled", false);
        },
        success: function(data) {
          if(data.errors) {
            $('#loader').hide();
            $('#info_window').show();
            $(submitButton).attr("disabled", false);
            if(data.errors.email) {
              errors.push($('#user_email'));
              $('#user_email_label').addClass('error', 500);
              $('#user_email').addClass('error', 500);
            }
            if(data.errors.name) {
              errors.push($('#user_name'));
              $('#user_name_label').addClass('error', 500);
              $('#user_name').addClass('error', 500);
            }
            if(data.errors.organization) {
              errors.push($('#user_organization'));
              $('#user_organization_label').addClass('error', 500);
              $('#user_organization').addClass('error', 500);
            }
            if(data.errors.voice_number) {
              errors.push($('#user_voice_number'));
              $('#user_voice_number_label').addClass('error', 500);
              $('#user_voice_number').addClass('error', 500);
            }
            if(data.errors.sms_number) {
              errors.push($('#user_sms_number'));
              $('#user_sms_number_label').addClass('error', 500);
              $('#user_sms_number').addClass('error', 500);
            }
            if(data.errors.password) {
              errors.push($('#user_password'));
              $('#user_password_label').addClass('error', 500);
              $('#user_password').addClass('error', 500);
            }
            if(data.errors.current_password) {
              errors.push($('#user_current_password'));
              $('#user_current_password_label').addClass('error', 500);
              $('#user_current_password').addClass('error', 500);
            }
            errors[0].focus();
          } else {
            activeInfoWindow.setContentHTML(data);
          }
        }
      });
    }
    return false;
  });
  $('#sign_out_form').live('submit', function() {
    var submitButton = $("#sign_out_form input[type='submit']");
    $(submitButton).attr("disabled", true);
    $.ajax({
      type: 'GET',
      url: '/users/sign_out.json',
      data: {
        'commit': submitButton.val(),
        'utf8': '?',
        'authenticity_token': $('#sign_out_form input[name="authenticity_token"]').val()
      },
      beforeSend: function() {
        $('#info_window').hide();
        $('#loader').show();
      },
      error: function(data) {
        console.log(data);
        $('#loader').hide();
        $('#info_window').show();
        $(submitButton).attr("disabled", false);
      },
      success: function(data) {
        $.ajax({
          type: 'GET',
          url: '/hydrant',
          data: {
            'hydrant_id': activeHydrantId
          },
          success: function(data) {
            activeInfoWindow.setContentHTML(data);
          }
        });
      }
    });
    return false;
  });
  $('#sign_in_form').live('submit', function() {
    var submitButton = $("#sign_in_form input[type='submit']");
    $(submitButton).attr("disabled", true);
    $.ajax({
      type: 'GET',
      url: '/users/sign_in',
      data: {
        'commit': submitButton.val(),
        'utf8': '?',
        'authenticity_token': $('#sign_in_form input[name="authenticity_token"]').val(),
      },
      beforeSend: function() {
        $('#info_window').hide();
        $('#loader').show();
      },
      error: function(data) {
        console.log(data);
        $('#loader').hide();
        $('#info_window').show();
        $(submitButton).attr("disabled", false);
      },
      success: function(data) {
        activeInfoWindow.setContentHTML(data);
      }
    });
    return false;
  });
  $('#back_form').live('submit', function() {
    var submitButton = $("#back_form input[type='submit']");
    $(submitButton).attr("disabled", true);
    $.ajax({
      type: 'GET',
      url: '/hydrant',
      data: {
        'commit': submitButton.val(),
        'utf8': '?',
        'authenticity_token': $('#back_form input[name="authenticity_token"]').val(),
        'hydrant_id': activeHydrantId
      },
      beforeSend: function() {
        $('#info_window').hide();
        $('#loader').show();
      },
      error: function(data) {
        console.log(data);
        $('#loader').hide();
        $('#info_window').show();
        $(submitButton).attr("disabled", false);
      },
      success: function(data) {
        activeInfoWindow.setContentHTML(data);
      }
    });
    return false;
  });
});