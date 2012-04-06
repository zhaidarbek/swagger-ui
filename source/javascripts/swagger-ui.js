jQuery(function($) {

  // this.baseUrl = "http://petstore.swagger.wordnik.com/api/resources.json";
  // this.apiKey = "special-key";

  var ApiSelectionController = Spine.Controller.create({
    proxied: ["showApi"],

    baseUrlList: new Array(),

    init: function() {
      if (this.supportsLocalStorage()) {
        var baseUrl = localStorage.getItem("com.wordnik.swagger.ui.baseUrl");
        var apiKey = localStorage.getItem("com.wordnik.swagger.ui.apiKey");

        if (baseUrl && baseUrl.length > 0)
        $("#input_baseUrl").val(baseUrl);

        if (apiKey && apiKey.length > 0)
        $("#input_apiKey").val(apiKey);

      } else {
        log("localStorage not supported, user will need to specifiy the api url");
      }

      $("a#explore").click(this.showApi);

      this.adaptToScale();
      $(window).resize(function() {
      	apiSelectionController.adaptToScale();
      });

      this.handleEnter();
    },

    handleEnter: function(){
      var self = this;
      var submit = function() {
        self.showApi();
      };
      $('#input_baseUrl').keydown(function(e) {
        if(e.which != 13) return;
        submit();
      });
      $('#input_apiKey').keydown(function(e) {
        if(e.which != 13) return;
        submit();
      });
    },

    adaptToScale: function() {
      // var form_width = $('form#api_selector').width();
      // var inputs_width = 0;
      // $('form#api_selector div.input').each( function(){ inputs_width += $(this).outerWidth(); });
      //
      // // Update with of baseUrl input
      // var free_width = form_width - inputs_width;
      // $('#input_baseUrl').width($('#input_baseUrl').width() + free_width - 50);
    },


    slapOn: function() {
      // messageController.showMessage("Please enter the base URL of the API that you wish to explore.");
      $("#content_message").show();
      $("#resources_container").hide();
      this.showApi();
    },

    supportsLocalStorage: function() {
      try {
        return 'localStorage' in window && window['localStorage'] !== null;
      } catch(e) {
        return false;
      }
    },

    showApi: function() {
      var baseUrl = jQuery.trim($("#input_baseUrl").val());
      var apiKey = jQuery.trim($("#input_apiKey").val());
      if (baseUrl.length == 0) {
        $("#input_baseUrl").wiggle();
      } else {
        if (this.supportsLocalStorage()) {
          localStorage.setItem("com.wordnik.swagger.ui.apiKey", apiKey);
          localStorage.setItem("com.wordnik.swagger.ui.baseUrl", baseUrl);
        }
        var resourceListController = ResourceListController.init({
          baseUrl: baseUrl,
          apiKey: apiKey
        });
      }
    }
  });

  var MessageController = Spine.Controller.create({
    showMessage: function(msg) {
      if (msg) {
        $("#content_message").html(msg);
        $("#content_message").show();
      } else {
        $("#content_message").html("");
        $("#content_message").hide();
      }

    },

    clearMessage: function() {
      this.showMessage();
    }
  });
  var messageController = MessageController.init();

  // The following heirarchy is followed by these view controllers
  // ResourceListController
  //   >>> ResourceController
  // >>> ApiController
  //  >>> OperationController
  var ResourceListController = Spine.Controller.create({
    proxied: ["addAll", "addOne"],

    ApiResource: null,

    init: function() {
      if (this.baseUrl == null) {
        throw new Error("A baseUrl must be passed to ResourceListController");
      }

      $("#content_message").hide();
      $("#resources_container").hide();
      $("#resources").html("");

      // create and initialize SwaggerService
      var swaggerService = new SwaggerService(this.baseUrl, this.apiKey,
      function(msg) {
        if (msg)
        messageController.showMessage(msg);
        else
        messageController.showMessage("Fetching remote JSON...");
      });

      // $("#api_host_url").html(swaggerService.apiHost());

      swaggerService.init();

      // Create convenience references to Spine models
      this.ApiResource = swaggerService.ApiResource();

      this.ApiResource.bind("refresh", this.addAll);
    },

    addAll: function() {
      this.ApiResource.each(this.addOne);
      messageController.clearMessage();
      $("#resources_container").slideDown(function() {
        setTimeout(function() {
          Docs.shebang();
        },
        400);
      });
    },

    addOne: function(apiResource) {
      ResourceController.init({
        item: apiResource,
        container: "#resources"
      });
    }
  });

  var ResourceController = Spine.Controller.create({
    proxied: ["renderApi", "renderOperation"],

    templateName: "#resourceTemplate",
    apiResource: null,
    apiList: null,
    modelList: null,

    init: function() {
      this.render();
      this.apiResource = this.item;
      this.apiList = this.apiResource.apiList;
      this.modelList = this.apiResource.modelList;
      this.apiList.each(this.renderApi);
    },

    render: function() {
      $(this.templateName).tmpl(this.item).appendTo(this.container);
      $('#colophon').fadeIn();
    },

    renderApi: function(api) {
      var resourceApisContainer = "#" + this.apiResource.name + "_endpoint_list";
      ApiController.init({
        resource: this.apiResource,
        item: api,
        container: resourceApisContainer
      });

    }

  });


  var ApiController = Spine.Controller.create({
    proxied: ["renderOperation"],

    api: null,
    templateName: "#apiTemplate",

    init: function() {
      this.render();

      this.api = this.item;

      this.api.operations.each(this.renderOperation);
    },

    render: function() {
      $(this.templateName).tmpl(this.item).appendTo(this.container);
    },

    renderOperation: function(operation) {
      var operationsContainer = "#" + this.api.name + "_endpoint_operations";
      OperationController.init({
        resource: this.resource,
        item: operation,
        container: operationsContainer
      });
    }
  });


  // Param Model
  // ----------------------------------------------------------------------------------------------
  var Param = Spine.Model.setup(
    "Param",
    ["name", "defaultValue", 'description', 'required', 'dataType', 'allowableValues', 'paramType', 'allowMultiple', "readOnly"]
  );

  Param.include({

    cleanup: function() {
      this.defaultValue = this.defaultValue || '';
    },

    templateName: function(){
      var n = "#paramTemplate";

      if (this.allowableValues && this.allowableValues.valueType == "LIST") {
        n += "Select";
      } else if(this.paramType == 'body') {
          n += "Json";
      } else {
        if (this.required) n += "Required";
        if (this.readOnly) n += "ReadOnly";
      }

      return(n);
    }

  });


  var OperationController = Spine.Controller.create({
    proxied: ["submitOperation", "submitOperationSigned", "showResponse", "showErrorStatus", "showCompleteStatus"],

    operation: null,
    templateName: "#operationTemplate",
    elementScope: "#operationTemplate",
    modelsArrayIndex: {},
    hasComplexType: false,

    init: function() {
      this.render();

      this.operation = this.item;
      this.isGetOperation = (this.operation.httpMethodLowercase == "get");
      this.elementScope = "#" + this.operation.apiName + "_" + this.operation.nickname + "_" + this.operation.httpMethod;

      this.renderParams();
    },

    render: function() {
      $(this.templateName).tmpl(this.item).appendTo(this.container);
    },

    renderParams: function() {
      if (this.operation.parameters && this.operation.parameters.count() > 0) {
        var operationParamsContainer = this.elementScope + "_params";

        for (var p = 0; p < this.operation.parameters.count(); p++) {
          var param = Param.init(this.operation.parameters.all()[p]);

          //
          if(param.paramType == "body" && !this.isPrimitiveType(param.dataType)){
              var modelHtml = $("<div/>");
              this.generateModelHtml(param.dataType, modelHtml);
              var tmplArgs = {  modelName: param.name,
                                modelHtml: modelHtml.html(),
                                description: param.description};
              $(param.templateName()).tmpl(tmplArgs).appendTo(operationParamsContainer);
              this.hasComplexType = true;
          } else {
              param.cleanup();
              $(param.templateName()).tmpl(param).appendTo(operationParamsContainer);
          }
        }
      }

      $(this.elementScope + "_content_sandbox_response_button").click(this.submitOperation);
      $(this.elementScope + "_content_sandbox_response_button_signed").click(this.submitOperationSigned);
    },

    generateModelHtml: function(dataType, parentNode, parentModelDef){
      log("generateModelHtml for " + dataType);
      var modelDef = this.getModelDef(dataType);
      if(!modelDef) return;

      var fieldsetCaption;
      if(parentModelDef){
          if(parentModelDef.container){ // on click Add more
              fieldsetCaption = this.modelsArrayIndex[parentModelDef.arrayItemId];
          } else if(modelDef.primitive) { // List[string]
              fieldsetCaption = parentModelDef.propName;
          } else if(modelDef.model) { // List[ComplexType]
              fieldsetCaption = parentModelDef.propName + " (" + modelDef.model.id + ")";
          }
      } else {
          fieldsetCaption = modelDef.model.id; // actual model (highest level ancestor)
      }

      var modelHtml = $("#modelTemplate").tmpl({ title: fieldsetCaption });
      modelHtml.appendTo(parentNode);

      if(modelDef.container){
          var arrayItemId = parentModelDef.propPath.replace(".", "_");
          $("#modelArrayActionsTemplate").tmpl({itemPath: arrayItemId, propName: parentModelDef.propName}).appendTo(modelHtml);

          var context = this.elementScope + "_params";
          $(".addArrayItem_" + arrayItemId, context).live('click', {refThis: this}, function(event){
              log("adding " + arrayItemId);
              var refThis = event.data.refThis;
              if(refThis.modelsArrayIndex[arrayItemId] === undefined){
                  refThis.modelsArrayIndex[arrayItemId] = 0;
              } else {
                  refThis.modelsArrayIndex[arrayItemId]++;
              }

              var propPath = parentModelDef ? parentModelDef.propPath : "";
              var pathArrIdx = "[" + refThis.modelsArrayIndex[arrayItemId] + "]";
              if(modelDef.model){
                  modelDef.propPath = propPath ? propPath + pathArrIdx : pathArrIdx;
                  modelDef.arrayItemId = arrayItemId;
                  refThis.generateModelHtml(modelDef.model.id, $(this).parent().parent(), modelDef);
              } else {
                  var tmplArgs = { name: refThis.modelsArrayIndex[arrayItemId],
                                    path: propPath ? propPath + pathArrIdx : pathArrIdx,
                                    type: modelDef.primitive };
                  $("#propTemplate").tmpl(tmplArgs).appendTo($(this).parent().parent());
              }
              $(".removeArrayItem_" + arrayItemId, context).show();
          });

          $(".removeArrayItem_" + arrayItemId, context).live('click', {refThis: this}, function(event){
              var refThis = event.data.refThis;
              if(refThis.modelsArrayIndex[arrayItemId] !== undefined){
                  if(refThis.modelsArrayIndex[arrayItemId] >= 0){
                      if(modelDef.primitive){
                          $('div.complexTypeProp:last-child', $(this).parent().parent()).remove();
                      } else {
                          $('fieldset:last-child', $(this).parent().parent()).remove();
                      }
                      refThis.modelsArrayIndex[arrayItemId]--;
                  }
                  if(refThis.modelsArrayIndex[arrayItemId] < 0){
                      $(this).hide();
                  }
              }
          });
      } else if(modelDef.model){
          for (var propIdx in modelDef.model.properties){
              var prop = modelDef.model.properties[propIdx];
              for (var propName in prop){
                  var propType = prop[propName].type;
                  var propPath = parentModelDef ? parentModelDef.propPath : "";
                  if(this.isPrimitiveType(propType)){
                      var tmplName = "#propTemplate";
                      var tmplArgs = { name: propName,
                                    path: (propPath ? propPath + "." + propName : propName), type: propType };
                      var constants = prop[propName]['enum'];
    //                  log(constants);
                      if(constants){
                          tmplName += "Select";
                          tmplArgs.allowableValues = constants;
                      }
                      $(tmplName).tmpl(tmplArgs).appendTo(modelHtml);
                  } else {
                      modelDef.propName = propName;
                      modelDef.propPath = propPath ? propPath + "." + propName : propName;
                      this.generateModelHtml(propType, modelHtml, modelDef);
                  }
              }
          }
      }
    },

    getModelDef: function(customOrContainerType) {
      var modelDef = { model: null, container: null, primitive: null };
      var regex = new RegExp("(List|Set|Array)\\[(\\w*)\\]");
      var matches = customOrContainerType.match(regex);
      var modelName;
      if(matches){
          modelDef.container = matches[1];
          modelName = matches[2];
          if(this.isPrimitiveType(modelName)){
              // List[string]
              modelDef.primitive = modelName;
              return modelDef;
          }
      } else {
          modelName = customOrContainerType;
      }

      for(var modelIdx in this.resource.rawModels){
          var model = this.resource.rawModels[modelIdx];
          if(model.id == modelName){
              modelDef.model = model;
              // CustomType or List[CustomType]
              return modelDef;
          }
      }
      return null;
    },

    isPrimitiveType: function(dataType){
        var type = dataType.toLowerCase();
        if(type == "string" || type == "int" || type == "integer" ||
            type == "long" || type == "float" || type == "double" ||
            type == "byte" || type == "boolean" || type == "date"){
            return true;
        } else {
            return false;
        }
    },

    submitOperation: function() {
      var form = $(this.elementScope + "_form");
      var error_free = true;
      var missing_input = null;

      // Cycle through the form's required inputs
      form.find("input.required").each(function() {

        // Remove any existing error styles from the input
        $(this).removeClass('error');

        // Tack the error style on if the input is empty..
        if ($(this).val() == '') {
          if (missing_input == null)
          missing_input = $(this);
          $(this).addClass('error');
          $(this).wiggle();
          error_free = false;
        }

      });

      if (error_free) {
        var formData = form.find("td>input, td>select").serializeArray();
        var invocationUrl = this.operation.invocationUrl(formData);
        if(invocationUrl){
            var requestData;
            if(this.hasComplexType){
                requestData = JSON.stringify(form2js(form.find("td>fieldset")[0]));
            } else {
                requestData = this.operation._queryParams;
            }

            $(".request_url", this.elementScope + "_content_sandbox_response").html("<pre>" + invocationUrl + "</pre>");
            $.ajax({
                type: this.operation.httpMethod,
                contentType: "application/json; charset=utf-8",
                url: invocationUrl,
                headers: this.operation._headers,
                data: requestData,
                dataType: "json",
                success: this.showResponse
            }).complete(this.showCompleteStatus).error(this.showErrorStatus);
        }
      }

    },

    submitOperationSigned: function() {
      var form = $(this.elementScope + "_form");
      var error_free = true;
      var missing_input = null;

      // Cycle through the form's required inputs
      form.find("input.required").each(function() {

        // Remove any existing error styles from the input
        $(this).removeClass('error');

        // Tack the error style on if the input is empty..
        if ($(this).val() == '') {
          if (missing_input == null)
          missing_input = $(this);
          $(this).addClass('error');
          $(this).wiggle();
          error_free = false;
        }

      });

      if (error_free) {
        var formData = form.find("td>input, td>select").serializeArray();
        log(formData);
        var privateKey = $("#input_privateKey").val();
        var invocationUrl = this.operation.invocationUrlSigned(formData, jQuery.trim(privateKey));
        log(this.operation._headers);
        if(invocationUrl){
            var requestData;
            if(this.hasComplexType){
                requestData = JSON.stringify(form2js(form.find("td>fieldset")[0]));
            } else {
                requestData = this.operation._queryParams;
            }
            log(requestData);

            $(".request_url", this.elementScope + "_content_sandbox_response").html("<pre>" + invocationUrl + "</pre>");
            $.ajax({
                type: this.operation.httpMethod,
                contentType: "application/json; charset=utf-8",
                url: invocationUrl,
                headers: this.operation._headers,
                data: requestData,
                dataType: "json",
                success: this.showResponse
            }).complete(this.showCompleteStatus).error(this.showErrorStatus);
        }
      }

    },

    showResponse: function(response) {
      // log(response);
      var prettyJson = JSON.stringify(response, null, "\t").replace(/\n/g, "<br>");
      // log(prettyJson);
      $(".response_body", this.elementScope + "_content_sandbox_response").html(prettyJson);

      $(this.elementScope + "_content_sandbox_response").slideDown();
    },

    showErrorStatus: function(data) {
      // log("error " + data.status);
      this.showStatus(data);
      $(this.elementScope + "_content_sandbox_response").slideDown();
    },

    showCompleteStatus: function(data) {
      // log("complete " + data.status);
      this.showStatus(data);
    },

    showStatus: function(data) {
      // log(data);
      // log(data.getAllResponseHeaders());
      var responseText;
      if(data.responseText){
         responseText = JSON.parse(data.responseText);
      } else {
        responseText = "";
      }
      var response_body = "<pre>" + JSON.stringify(responseText, null, 2).replace(/\n/g, "<br>") + "</pre>";
      $(".response_code", this.elementScope + "_content_sandbox_response").html("<pre>" + data.status + "</pre>");
      $(".response_body", this.elementScope + "_content_sandbox_response").html(response_body);
      $(".response_headers", this.elementScope + "_content_sandbox_response").html("<pre>" + data.getAllResponseHeaders() + "</pre>");
    }

  });

  // Attach controller to window*
  window.apiSelectionController = ApiSelectionController.init();

  if (this.baseUrl) {
    window.resourceListController = ResourceListController.init({
      baseUrl: this.baseUrl,
      apiKey: this.apiKey
    });
  } else {
    apiSelectionController.slapOn();
  }

});

